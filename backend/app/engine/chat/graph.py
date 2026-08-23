import json
import uuid
from typing import AsyncIterator 

from langchain_core.messages import BaseMessage
from langgraph.graph import StateGraph, START, END  

from app.engine.chat.state import ChatState
from app.engine.chat.nodes import (
    rewriter_classifier_node,
    retriever_node,
    generator_node
)

from app.engine.chat.edges import router_retrieval
from app.engine.core.tracing.callbacks import create_trace_config


# ----------------------- Graph -----------------------
builder = StateGraph(ChatState)

builder.add_node("rewriter", rewriter_classifier_node)
builder.add_node("retriever", retriever_node)
builder.add_node("generator", generator_node)

builder.add_edge(START, "rewriter")
builder.add_conditional_edges(
    "rewriter",
    router_retrieval,
    {
        "retriever": "retriever",
        "generator": "generator"
    }
)
builder.add_edge("retriever", "generator")
builder.add_edge("generator", END)

rag_graph = builder.compile()



# ----------------------- Streaming Helper -----------------------
async def stream_rag_chat(
    messages: list[BaseMessage],
    conversation_id: uuid.UUID | None = None,
    request_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None
) -> AsyncIterator[dict]:
    
    initial_state = {
        "messages": messages,
        "last_k_messages": 8
    }
    
    trace_config = create_trace_config(
        run_name="RAG_Conversation_Turn",
        conversation_id=conversation_id,
        request_id=request_id,
        user_id=user_id,
        tags=["rag-chat", "development"]
    )

    in_think_block = False
    think_buffer = ""

    async for event in rag_graph.astream_events(initial_state, config=trace_config, version="v2"):
        kind = event["event"]
        node_name = event.get("metadata", {}).get("langgraph_node")

        # 1. Stream token chunks from generator
        if kind == "on_chat_model_stream" and node_name == "generator":
            chunk = event["data"]["chunk"]
            
            # Check for native reasoning / thought attributes (DeepSeek / Nemotron / OpenAI / Gemini)
            reasoning_delta = (
                chunk.additional_kwargs.get("reasoning_content")
                or chunk.additional_kwargs.get("thought")
                or getattr(chunk, "response_metadata", {}).get("reasoning_content")
            )
            if reasoning_delta:
                yield {"type": "think", "delta": str(reasoning_delta)}

            # Extract text delta
            chunk_content = chunk.content
            delta = ""
            if isinstance(chunk_content, str):
                delta = chunk_content
            elif isinstance(chunk_content, list):
                parts = []
                for p in chunk_content:
                    if isinstance(p, str):
                        parts.append(p)
                    elif isinstance(p, dict):
                        # Check if part is a thought part
                        if p.get("type") == "thought" or p.get("thought"):
                            t_text = p.get("text", "")
                            if t_text:
                                yield {"type": "think", "delta": t_text}
                        elif "text" in p:
                            parts.append(p["text"])
                    else:
                        parts.append(str(p))
                delta = "".join(parts)
            
            if delta:
                # Check for <think> ... </think> tags in the text stream
                if "<think>" in delta:
                    in_think_block = True
                    parts = delta.split("<think>", 1)
                    if parts[0]:
                        yield {"type": "chunk", "delta": parts[0]}
                    delta = parts[1]

                if in_think_block:
                    if "</think>" in delta:
                        in_think_block = False
                        think_parts = delta.split("</think>", 1)
                        if think_parts[0]:
                            yield {"type": "think", "delta": think_parts[0]}
                        if think_parts[1]:
                            yield {"type": "chunk", "delta": think_parts[1]}
                    else:
                        yield {"type": "think", "delta": delta}
                else:
                    yield {"type": "chunk", "delta": delta}

        elif kind == "on_node_start":
            if event["name"] == "rewriter":
                yield {"type": "status", "stage": "analysis", "content": "Analysing query..."}
            elif event["name"] == "retriever":
                yield {"type": "status", "stage": "retrieval", "content": "Searching knowledge base..."}
            elif event["name"] == "generator":
                yield {"type": "status", "stage": "generating", "content": "Generating response..."}

        elif kind == "on_node_end" and event["name"] == "rewriter":
            output = event.get("data", {}).get("output", {})
            if output.get("retrieval_needed"):
                query = output.get("retrieval_query", "")
                yield {
                    "type": "status",
                    "stage": "decision",
                    "content": f"Searching for: '{query}'"
                }
            else:
                yield {
                    "type": "status",
                    "stage": "decision",
                    "content": "No retrieval needed."
                }
