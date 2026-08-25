import time
import logging
from typing import Dict
from langchain_core.runnables import RunnableConfig
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage
from app.engine.chat.state import ChatState

from app.engine.core.llm.models import (
    rewriter_chain,
    generator_llm,
)

from app.engine.chat.schemas import (
    RewriteDecision,
    TitleResponse
)
from app.engine.core.prompts import get_prompt, PromptName

logger = logging.getLogger("app.engine.nodes")


def _formate_message_to_string(messages: list[BaseMessage]) -> str:
    formatted = []
    for msg in messages:
        role = "User" if isinstance(msg, HumanMessage) else "Assistant"
        formatted.append(f"{role}: {msg.content}")
    return "\n".join(formatted)


# ----------------  Rewriter & Classifier Node ----------------
async def rewriter_classifier_node(state: ChatState, config: RunnableConfig = None):
    t0 = time.perf_counter()
    messages = state.get("messages", [])
    if not messages:
        raise ValueError("At least 1 message is required in state['messages']")
    
    last_message = messages[-1]
    query_text = last_message.content

    max_k = state.get("last_k_messages", 8)
    previous_messages = messages[:-1]
    
    history_slice = previous_messages[-max_k:] if previous_messages else []
    # Provide non-empty fallback so Google GenAI never receives empty content
    history_text = _formate_message_to_string(history_slice) or "No previous history."

    logger.info(f"[Rewriter] Starting query analysis | query='{query_text[:60]}' | history_msgs={len(history_slice)}")

    system_prompt = get_prompt(PromptName.REWRITER)
    chain = rewriter_chain(system_prompt)

    decision: RewriteDecision = await chain.ainvoke(
        {
            "history": history_text,
            "query": query_text
        },
        config=config
    )
    
    elapsed_ms = (time.perf_counter() - t0) * 1000
    logger.info(
        f"[Rewriter] Completed in {elapsed_ms:.1f}ms | "
        f"need_retrieval={decision.need_retrieval} | "
        f"retrieval_query='{decision.query}'"
    )
    
    return {
        "retrieval_needed": decision.need_retrieval,
        "retrieval_query": decision.query if decision.need_retrieval else "",
    }

    


# ---------------- Document Retrival ----------------
async def retriever_node(state: ChatState, config: RunnableConfig = None):
    t0 = time.perf_counter()
    query = state.get("retrieval_query")
    logger.info(f"[Retriever] Fetching documents for query='{query}'")

    retrieved_documents: list[str] = []
    if query:
        try:
            from app.engine.rag.vector.vector_store import VectorService
            metadata = (config or {}).get("metadata", {})
            conversation_id = metadata.get("conversation_id")
            user_id = metadata.get("user_id")

            vector_service = VectorService()
            docs = await vector_service.get_documents(
                query=query,
                user_id=user_id,
                conversation_id=conversation_id,
                top_k=4,
            )
            retrieved_documents = [d.page_content for d in docs]
        except Exception as e:
            logger.warning(f"[Retriever] Vector search error: {e}")

    elapsed_ms = (time.perf_counter() - t0) * 1000
    logger.info(f"[Retriever] Retrieved {len(retrieved_documents)} documents in {elapsed_ms:.1f}ms")
    
    return {
        "retrieved_docs": retrieved_documents,
    }    
    


# ---------------- Answer Generator Node ----------------
async def generator_node(state: ChatState, config: RunnableConfig = None):
    t0 = time.perf_counter()
    retrieved_docs = state.get("retrieved_docs", [])
    context_str = "\n\n".join(retrieved_docs) if retrieved_docs else ""

    logger.info(f"[Generator] Invoking LLM generator | context_docs={len(retrieved_docs)} | msgs={len(state.get('messages', []))}")

    prompt = get_prompt(PromptName.GENERATOR)
    llm = generator_llm()
    chain = prompt | llm

    response: AIMessage = await chain.ainvoke(
        {"context": context_str, "messages": state.get("messages")},
        config=config
    )

    answer_text = response.content
    if isinstance(answer_text, list):
        answer_text = "".join(
            part.get("text", "") if isinstance(part, dict) else str(part)
            for part in answer_text
        )

    elapsed_ms = (time.perf_counter() - t0) * 1000
    logger.info(f"[Generator] Answer generation completed in {elapsed_ms:.1f}ms (response_len={len(answer_text)})")

    return {
        "messages": [response],
        "final_answer": answer_text
    }
