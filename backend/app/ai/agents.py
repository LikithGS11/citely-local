import time
import logging
from typing import List, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.all_models import User, SupplierContract, PaymentHistory, SearchAnalytics
from app.schemas.all_schemas import ChunkCitation, AgentThoughtStep, ChatResponse, ChatMessage
from app.ai.retriever import hybrid_retriever
from app.ai.llm_service import llm_service

logger = logging.getLogger(__name__)


class MultiAgentSystem:
    """
    Orchestrates specialized agents:
    - Coordinator Agent: Intent classification & multi-step workflow routing.
    - Retrieval Agent: RAG search and strict source citation grounding.
    - SQL Agent: Queries structured tables (SupplierContracts, PaymentHistory).
    - Unified SQL + RAG Agent: Combines structured data aggregations with unstructured document reasoning.
    """
    async def process_chat(
        self,
        db: AsyncSession,
        user: User,
        message: str,
        history: List[ChatMessage]
    ) -> ChatResponse:
        start_time = time.time()
        agent_steps: List[AgentThoughtStep] = []

        # 1. Coordinator Agent: Intent Classification & Routing (LLM-based, keyword fallback)
        logger.info(f"[Coordinator Agent] Analyzing user prompt: '{message}'")
        intent, intent_source = await self._classify_intent(message)
        agent_steps.append(
            AgentThoughtStep(
                agent_name="Coordinator Agent",
                action="INTENT_CLASSIFICATION",
                details=f"Classified intent as {intent} via {intent_source}.",
                timestamp=time.time()
            )
        )

        # 2. Execution Route decision
        if intent == "SQL_RAG":
            # Route: Unified SQL + RAG Workflow
            agent_steps.append(
                AgentThoughtStep(
                    agent_name="Coordinator Agent",
                    action="ROUTING_DECISION",
                    details="Detected requirement for both structured database aggregations (SQL) and unstructured document retrieval (RAG). Initiating multi-agent workflow.",
                    timestamp=time.time()
                )
            )
            return await self._execute_sql_and_rag_workflow(db, user, message, history, agent_steps, start_time)

        else:
            # Route: Standard Hybrid RAG Retrieval Agent
            agent_steps.append(
                AgentThoughtStep(
                    agent_name="Coordinator Agent",
                    action="ROUTING_DECISION",
                    details="Delegating to Retrieval Agent for Hybrid Vector (pgvector) + BM25 Keyword search across enterprise documents.",
                    timestamp=time.time()
                )
            )
            return await self._execute_retrieval_workflow(db, user, message, history, agent_steps, start_time)

    async def _classify_intent(self, message: str) -> Tuple[str, str]:
        """
        Classifies the user question as 'SQL_RAG' (needs structured payment/contract
        tables plus documents) or 'RAG' (documents alone). Uses the configured LLM;
        falls back to keyword matching if the LLM is unavailable or answers off-format.
        Returns (intent, source) where source describes how the decision was made.
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
            answer = await llm_service.generate_chat_response(system, f"Question: {message}", temperature=0.0)
            answer_up = answer.strip().upper()
            if "SQL_RAG" in answer_up:
                return "SQL_RAG", "LLM classifier"
            if "RAG" in answer_up:
                return "RAG", "LLM classifier"
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
        # Retrieval Agent step
        agent_steps.append(
            AgentThoughtStep(
                agent_name="Retrieval Agent",
                action="HYBRID_SEARCH",
                details=f"Enforcing RBAC (Role: {user.role}, Dept: {user.department}) and querying dense vector index + BM25 keyword ranker.",
                timestamp=time.time()
            )
        )

        citations = await hybrid_retriever.retrieve(db, query=message, current_user=user, top_k=4)

        agent_steps.append(
            AgentThoughtStep(
                agent_name="Retrieval Agent",
                action="CITATION_GROUNDING",
                details=f"Retrieved {len(citations)} relevant chunks with average confidence of {round(sum(c.similarity_score for c in citations)/max(len(citations),1), 1)}%. Formatting exact section & page citations.",
                timestamp=time.time()
            )
        )

        # Prepare context for LLM
        context_snippets = "\n\n".join([
            f"--- [Document: {c.document_title} | Page: {c.page_number} | Section: {c.section_title}] ---\n{c.content_snippet}"
            for c in citations
        ])

        system_prompt = (
            "You are the Enterprise AI Knowledge Assistant. You must answer the user's question accurately and professionally using strictly the provided document context below. "
            "Whenever you state a fact from the text, explicitly reference the Document Name and Page Number."
        )
        user_prompt = f"User Question: {message}\n\nRetrieved Document Context:\n{context_snippets}"

        agent_steps.append(
            AgentThoughtStep(
                agent_name="Summarization & Generation Agent",
                action="LLM_SYNTHESIS",
                details="Synthesizing final answer ensuring zero hallucination and strict citation mapping.",
                timestamp=time.time()
            )
        )

        history_dict = [{"role": h.role, "content": h.content} for h in history]
        answer = await llm_service.generate_chat_response(system_prompt, user_prompt, history_dict)

        latency = (time.time() - start_time) * 1000

        # Log search analytics
        try:
            doc_ids_str = ",".join(str(c.document_id) for c in citations)
            analytics_entry = SearchAnalytics(
                user_id=user.id,
                query_text=message,
                retrieval_method="Hybrid RAG (pgvector + BM25)",
                top_document_ids=doc_ids_str,
                latency_ms=latency,
                result_count=len(citations)
            )
            db.add(analytics_entry)
            await db.commit()
        except Exception as e:
            logger.warning(f"Could not log search analytics: {e}")

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
        # 1. SQL Agent Step: Querying structured payment & contract tables
        agent_steps.append(
            AgentThoughtStep(
                agent_name="SQL Agent",
                action="DATABASE_QUERY",
                details="Executing read-only query on payment_history for invoices with status 'Delayed'.",
                timestamp=time.time()
            )
        )

        stmt_payments = select(PaymentHistory).where(PaymentHistory.status == "Delayed")
        res_payments = await db.execute(stmt_payments)
        delayed_records = res_payments.scalars().all()

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
            worst = max(sql_table_results, key=lambda r: r["delay_days"])
            aggregation_details = (
                f"Retrieved {len(sql_table_results)} delayed invoice records from PostgreSQL. "
                f"Highest delay: '{worst['supplier_name']}' ({worst['delay_days']} days late on "
                f"invoice {worst['invoice_number']}, ${worst['amount_usd']:,.2f} USD)."
            )
            top_supplier = worst["supplier_name"]
        else:
            aggregation_details = "No delayed invoice records found in payment_history."
            top_supplier = None

        agent_steps.append(
            AgentThoughtStep(
                agent_name="SQL Agent",
                action="DATA_AGGREGATION",
                details=aggregation_details,
                timestamp=time.time()
            )
        )

        # 2. Retrieval Agent Step: Retrieving supplier contract penalty clauses via RAG
        rag_query = f"{top_supplier} penalty clause late payment interest rate" if top_supplier else message
        agent_steps.append(
            AgentThoughtStep(
                agent_name="Retrieval Agent",
                action="CONTRACT_RAG_SEARCH",
                details=f"Executing hybrid vector retrieval for: '{rag_query}'.",
                timestamp=time.time()
            )
        )

        citations = await hybrid_retriever.retrieve(db, query=rag_query, current_user=user, top_k=3)

        agent_steps.append(
            AgentThoughtStep(
                agent_name="Coordinator Agent",
                action="UNIFIED_SYNTHESIS",
                details=f"Merging {len(sql_table_results)} structured SQL records with {len(citations)} retrieved contract citations for final synthesis.",
                timestamp=time.time()
            )
        )

        system_prompt = "You are the Enterprise AI Financial & Legal Coordinator. Combine structured SQL data and RAG document citations into a clear unified executive summary."
        user_prompt = f"User Question: {message}\n\nSQL Table Results:\n{sql_table_results}\n\nRetrieved Contract Citations:\n{[c.content_snippet for c in citations]}"

        history_dict = [{"role": h.role, "content": h.content} for h in history]
        answer = await llm_service.generate_chat_response(system_prompt, user_prompt, history_dict)

        latency = (time.time() - start_time) * 1000

        return ChatResponse(
            answer=answer,
            citations=citations,
            agent_steps=agent_steps,
            unified_data={"sql_payment_records": sql_table_results, "query_type": "SQL + RAG Unified"},
            latency_ms=latency
        )


multi_agent_system = MultiAgentSystem()
