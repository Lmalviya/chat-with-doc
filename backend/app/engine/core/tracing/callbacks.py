import uuid
from typing import Optional, Any
from langchain_core.runnables import RunnableConfig

def create_trace_config(
    run_name: str,
    request_id: Optional[uuid.UUID] = None,
    conversation_id: Optional[uuid.UUID] = None,
    user_id: Optional[uuid.UUID] = None,
    tags: Optional[list[str]] = None,
    extra_metadata: Optional[dict[str, Any]] = None
) -> RunnableConfig:

    metadata: dict[str, Any] = {}
    if request_id:
        metadata["request_id"] = str(request_id)
    if conversation_id:
        metadata["conversation_id"] = str(conversation_id)
    if user_id:
        metadata["user_id"] = str(user_id)
    if extra_metadata:
        metadata.update(extra_metadata)
    
    run_tags = tags or []
    if "rag-qna" not in run_tags:
        run_tags.append("rag-qna")
    
    return RunnableConfig(
        run_name=run_name,
        metadata=metadata,
        tags=run_tags
    )


# trace_config = create_trace_config(
#     run_name="rewriter_step",
#     request_id=request_id,
#     conversation_id=conversation_id,
#     user_id=user_id,
#     tag=["rewriter", "development"]
# )

# result = await graph.ainvoke(state, config=trace_config)