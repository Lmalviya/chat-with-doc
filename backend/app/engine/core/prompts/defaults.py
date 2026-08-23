from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

# Query Rewriter & Decision Prompt
DEFAULT_REWRITER_SYSTEM_PROMPT = """You are an expert query analyzer in a document-based Q&A system.
Analyze the user's latest query and the conversation history:
1. Determine if external document retrieval is needed (`need_retrieval`).
   - Set `need_retrieval = True` if the user is asking questions requiring factual information from documents.
   - Set `need_retrieval = False` for greetings, small talk, or conversational meta-queries.
2. If `need_retrieval = True`, rewrite the user's question into a clean, standalone search query (`query`) that resolves any ambiguous pronouns (e.g. 'it', 'that') using the conversation history.
    If retrieval is not needed, set query to empty string.

<history>
{history}
</history>
"""

DEFAULT_REWRITER_PROMPT = ChatPromptTemplate.from_messages([
    ("system", DEFAULT_REWRITER_SYSTEM_PROMPT),
    ("human", "{query}"),
])

# RAG Answer Generator Prompt
DEFAULT_GENERATOR_SYSTEM_PROMPT = """You are an accurate, helpful assistant.
Answer the user's question using ONLY the provided document context below.
If the context does not contain enough information to answer, state clearly that you do not have enough information from the documents. Do not speculate or hallucinate.
<context>
{context}
</context>"""

DEFAULT_GENERATOR_PROMPT = ChatPromptTemplate.from_messages([
    ("system", DEFAULT_GENERATOR_SYSTEM_PROMPT),
    MessagesPlaceholder(variable_name="messages"),
])

# Conversation Title Generator Prompt
DEFAULT_TITLE_SYSTEM_PROMPT = """Generate a concise, descriptive title (3 to 6 words) that summarizes the topic of the user's message.
Return only the plain title. Do not include quotes, prefixes like 'Title:', or punctuation."""
DEFAULT_TITLE_PROMPT = ChatPromptTemplate.from_messages([
    ("system", DEFAULT_TITLE_SYSTEM_PROMPT),
    ("human", "{query}"),
])