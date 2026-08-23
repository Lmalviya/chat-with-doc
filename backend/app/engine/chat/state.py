import operator
from typing import List, Annotated
from typing_extensions import TypedDict
from langchain_core.messages import AnyMessage


class ChatState(TypedDict):
    messages: Annotated[List[AnyMessage], operator.add]
    last_k_messages: int 
    retrieval_needed: bool
    retrieval_query: str

    retrieved_docs: List[str]
    final_answer: str

