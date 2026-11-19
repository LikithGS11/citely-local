import time
import logging
from typing import List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.models.all_models import User, PaymentHistory
from app.schemas.all_schemas import ChunkCitation, AgentThoughtStep, ChatResponse, ChatMessage
from app.ai.retriever import hybrid_retriever
from app.ai.llm_service import llm_service
from app.services.analytics_service import log_search

logger = logging.getLogger(__name__)

# How many prior chat messages are sent to the LLM (keeps prompts inside num_ctx)
MAX_HISTORY_MESSAGES = 8
# Cap on structured rows put into the SQL+RAG prompt
MAX_SQL_ROWS = 25


def _format_citations(citations: List[ChunkCitation]) -> str:
    return "\n\n".join(
        f"--- [Document: {c.document_title} | Page: {c.page_number} | Section: {c.section_title}] ---\n{c.content_snippet}"
        for c in citations
    )


def _step(agent: str, action: str, details: str) -> AgentThoughtStep:
    return AgentThoughtStep(agent_name=agent, action=action, details=details, timestamp=time.time())


class MultiAgentSystem:
    """
    Routes each question down one of two fixed pipelines:
    - RAG: hybrid retrieval over documents, then LLM synthesis with citations.
    - SQL+RAG: a fixed read-only query of delayed invoices in payment_history,
      plus contract retrieval for the worst offender, then LLM synthesis.
    The route is picked by an LLM classifier with a keyword fallback.
    """
    async def process_chat(
        self,
        db: AsyncSession,
        user: User,
        message: str,
        history: List[ChatMessage]
    ) -> ChatResponse:
        start_time = time.time()
        history = self._clean_history(history, message)
        agent_steps: List[AgentThoughtStep] = []

        intent, intent_source = await self._classify_intent(message)
        agent_steps.append(_step("Coordinator Agent", "INTENT_CLASSIFICATION", f"Classified intent as {intent} via {intent_source}."))

        if intent == "SQL_RAG":
            agent_steps.append(_step(
                "Coordinator Agent", "ROUTING_DECISION",
                "Question needs payment records plus contract text: querying payment_history, then searching documents."
            ))
            return await self._execute_sql_and_rag_workflow(db, user, message, history, agent_steps, start_time)

        agent_steps.append(_step(
            "Coordinator Agent", "ROUTING_DECISION",
            "Delegating to Retrieval Agent for hybrid vector (pgvector) + BM25 keyword search across documents."
        ))
        return await self._execute_retrieval_workflow(db, user, message, history, agent_steps, start_time)

    @staticmethod
    def _clean_history(history: List[ChatMessage], message: str) -> List[ChatMessage]:
        """Drop non-chat roles, a trailing copy of the current question (it is sent
        separately with its retrieved context), and anything beyond the window."""
        cleaned = [h for h in history if h.role in ("user", "assistant") and h.content.strip()]
        if cleaned and cleaned[-1].role == "user" and cleaned[-1].content.strip() == message.strip():
            cleaned = cleaned[:-1]
        return cleaned[-MAX_HISTORY_MESSAGES:]

    async def _classify_intent(self, message: str) -> Tuple[str, str]:
        """
        Classifies the question as 'SQL_RAG' (needs the payment/contract tables plus
        documents) or 'RAG' (documents alone). Uses the configured LLM; falls back to
        keyword matching if the LLM is unavailable or answers off-format.
        """
        system = (
            "You are an intent classifier for an enterprise knowledge assistant. "
            "Reply with exactly one word and nothing else.\n"
            "Reply SQL_RAG if answering requires structured financial database records "
            "(supplier payment history, delayed/late invoices, amounts owed, contract table lookups) "
            "possibly combined with document retrieval.\n"
            "Reply RAG if the question can be answered from company documents alone "
            "(policies, SOPs, guides, contract text, general knowledge searches)."
        )
        try:
            answer = await llm_service.generate_chat_response(
                system, f"Question: {message}", temperature=0.0, think=False
            )
            first_word = (answer.strip().split() or [""])[0].strip(".:,\"'`*").upper()
            if first_word in ("SQL_RAG", "RAG"):
                return first_word, "LLM classifier"
            logger.warning(f"Intent classifier returned off-format answer: '{answer[:80]}'")
        except Exception as e:
            logger.warning(f"LLM intent classification failed: {e}")

        keywords = ["delayed payment", "payment history", "invoice", "highest delayed", "amount owed", "how much owed"]
        if any(k in message.lower() for k in keywords):
            return "SQL_RAG", "keyword fallback"
        return "RAG", "keyword fallback"

    async def _execute_retrieval_workflow(
        self,
        db: AsyncSession,
        user: User,
        message: str,
        history: List[ChatMessage],
        agent_steps: List[AgentThoughtStep],
        start_time: float
    ) -> ChatResponse:
        agent_steps.append(_step(
            "Retrieval Agent", "HYBRID_SEARCH",
            "Querying the pgvector index and re-ranking candidates with BM25 + reciprocal rank fusion."
        ))

        citations = await hybrid_retriever.retrieve(db, query=message, current_user=user, top_k=4)

        avg = round(sum(c.similarity_score for c in citations) / max(len(citations), 1), 1)
        agent_steps.append(_step(
            "Retrieval Agent", "CITATION_GROUNDING",
            f"Retrieved {len(citations)} chunks (average cosine similarity {avg}%)."
        ))

        system_prompt = (
            "You are the Enterprise AI Knowledge Assistant. Answer the user's question using only the "
            "document context provided. Whenever you state a fact from the context, cite the Document Name "
            "and Page Number. If the context does not contain the answer, say so plainly."
        )
        user_prompt = f"User Question: {message}\n\nRetrieved Document Context:\n{_format_citations(citations) or '(no matching documents)'}"

        agent_steps.append(_step("Generation Agent", "LLM_SYNTHESIS", "Generating an answer from the retrieved context."))

        history_dict = [{"role": h.role, "content": h.content} for h in history]
        answer = await llm_service.generate_chat_response(system_prompt, user_prompt, history_dict)

        latency = (time.time() - start_time) * 1000
        await log_search(db, user.id, message, "Chat: Hybrid RAG", citations, latency)

        return ChatResponse(
            answer=answer,
            citations=citations,
            agent_steps=agent_steps,
            unified_data=None,
            latency_ms=latency
        )

    async def _execute_sql_and_rag_workflow(
        self,
        db: AsyncSession,
        user: User,
        message: str,
        history: List[ChatMessage],
        agent_steps: List[AgentThoughtStep],
        start_time: float
    ) -> ChatResponse:
        agent_steps.append(_step(
            "SQL Agent", "DATABASE_QUERY",
            f"Running a fixed read-only query: invoices with status 'Delayed' in payment_history, worst {MAX_SQL_ROWS} by delay."
        ))

        stmt_payments = (
            select(PaymentHistory)
            .where(PaymentHistory.status == "Delayed")
            .order_by(desc(PaymentHistory.delay_days))
            .limit(MAX_SQL_ROWS)
        )
        delayed_records = (await db.execute(stmt_payments)).scalars().all()

        sql_table_results = [
            {
                "invoice_number": p.invoice_number,
                "supplier_name": p.supplier_name,
                "amount_usd": p.amount_usd,
                "delay_days": p.delay_days,
                "status": p.status
            }
            for p in delayed_records
        ]

        if sql_table_results:
            worst = max(sql_table_results, key=lambda r: r["delay_days"] or 0)
            aggregation_details = (
                f"Retrieved {len(sql_table_results)} delayed invoice records. "
                f"Highest delay: '{worst['supplier_name']}' ({worst['delay_days']} days late on "
                f"invoice {worst['invoice_number']}, ${worst['amount_usd']:,.2f} USD)."
            )
            top_supplier = worst["supplier_name"]
        else:
            aggregation_details = "No delayed invoice records found in payment_history."
            top_supplier = None

        agent_steps.append(_step("SQL Agent", "DATA_AGGREGATION", aggregation_details))

        rag_query = f"{top_supplier} penalty clause late payment interest rate" if top_supplier else message
        agent_steps.append(_step("Retrieval Agent", "CONTRACT_RAG_SEARCH", f"Hybrid retrieval for: '{rag_query}'."))

        citations = await hybrid_retriever.retrieve(db, query=rag_query, current_user=user, top_k=3)

        agent_steps.append(_step(
            "Coordinator Agent", "UNIFIED_SYNTHESIS",
            f"Combining {len(sql_table_results)} payment records with {len(citations)} document citations."
        ))

        if sql_table_results:
            table = "invoice | supplier | amount_usd | delay_days\n" + "\n".join(
                f"{r['invoice_number']} | {r['supplier_name']} | {r['amount_usd']:.2f} | {r['delay_days']}"
                for r in sql_table_results
            )
        else:
            table = "(no delayed invoices found)"

        system_prompt = (
            "You are the Enterprise AI Financial & Legal Coordinator. Combine the payment records and the "
            "document excerpts into a clear summary. Use only the data given; cite Document Name and Page "
            "Number for document facts, and say plainly if something isn't covered."
        )
        user_prompt = (
            f"User Question: {message}\n\nDelayed payment records (from payment_history):\n{table}\n\n"
            f"Retrieved Contract Excerpts:\n{_format_citations(citations) or '(no matching documents)'}"
        )

        history_dict = [{"role": h.role, "content": h.content} for h in history]
        answer = await llm_service.generate_chat_response(system_prompt, user_prompt, history_dict)

        latency = (time.time() - start_time) * 1000
        await log_search(db, user.id, message, "Chat: SQL + RAG", citations, latency)

        return ChatResponse(
            answer=answer,
            citations=citations,
            agent_steps=agent_steps,
            unified_data={"sql_payment_records": sql_table_results, "query_type": "SQL + RAG Unified"},
            latency_ms=latency
        )


multi_agent_system = MultiAgentSystem()
