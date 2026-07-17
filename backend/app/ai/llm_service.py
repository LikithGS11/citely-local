import re
import logging
from typing import List, Dict, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

try:
    from openai import AsyncOpenAI
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False


class LLMService:
    """
    Routes chat generation to a local Ollama server (default), the OpenAI API,
    or an extractive fallback that only quotes retrieved context — it never
    invents facts.
    """
    def __init__(self):
        self.provider = settings.LLM_PROVIDER
        self.openai_client = None
        if self.provider == "openai" and HAS_OPENAI and settings.OPENAI_API_KEY:
            self.openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            logger.info("Initialized AsyncOpenAI client.")
        elif self.provider == "ollama":
            logger.info(f"Using Ollama at {settings.OLLAMA_BASE_URL} (model: {settings.OLLAMA_MODEL}).")
        else:
            logger.info("No LLM configured — answers will be extractive from retrieved context only.")

    async def generate_chat_response(
        self,
        system_prompt: str,
        user_prompt: str,
        history: Optional[List[Dict[str, str]]] = None,
        temperature: float = 0.2
    ) -> str:
        messages = [{"role": "system", "content": system_prompt}]
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": user_prompt})

        if self.provider == "ollama":
            try:
                return await self._ollama_chat(messages, temperature)
            except Exception as e:
                logger.error(f"Ollama call failed: {e}. Returning extractive fallback.")

        if self.openai_client:
            try:
                response = await self.openai_client.chat.completions.create(
                    model=settings.OPENAI_MODEL_NAME,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=1000,
                )
                return response.choices[0].message.content.strip()
            except Exception as e:
                logger.error(f"OpenAI API call failed: {e}. Returning extractive fallback.")

        return self._extractive_fallback(user_prompt)

    async def _ollama_chat(self, messages: List[Dict[str, str]], temperature: float) -> str:
        async with httpx.AsyncClient(timeout=180.0) as client:
            resp = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/chat",
                json={
                    "model": settings.OLLAMA_MODEL,
                    "messages": messages,
                    "stream": False,
                    "options": {"temperature": temperature},
                },
            )
            resp.raise_for_status()
            data = resp.json()
        content = (data.get("message") or {}).get("content", "")
        # Thinking models (e.g. qwen3) may inline <think>...</think> blocks — strip them
        content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
        if not content:
            raise RuntimeError("Ollama returned an empty response")
        return content

    def _extractive_fallback(self, user_prompt: str) -> str:
        """
        No LLM reachable: answer honestly by returning the retrieved context
        verbatim instead of fabricating a synthesis.
        """
        # user_prompt is formatted as "User Question: ...\n\n<context label>:\n<context>"
        context = ""
        marker = user_prompt.find("\n\n")
        if marker != -1:
            context = user_prompt[marker:].strip()
        if len(context) > 2500:
            context = context[:2500] + "\n\n[...truncated]"

        if context:
            return (
                "⚠️ The AI model is currently unreachable, so no generated summary is available. "
                "Here is the raw retrieved material relevant to your question:\n\n" + context
            )
        return (
            "⚠️ The AI model is currently unreachable and no document context was retrieved for this query. "
            "Please check that Ollama is running (`ollama serve`) or try again."
        )


llm_service = LLMService()
