from typing import Literal
from app.engine.chat.state import ChatState

def router_retrieval(state: ChatState):
    if state.get("retrieval_needed", False):
        return "retriever"
    else:
        return "generator"
        