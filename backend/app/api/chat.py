import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.financial_agent import answer_question
from app.config import get_settings
from app.database import get_session
from app.models import Conversation, DocumentChunk, Document, Message, Source
from app.rag.embeddings import EmbeddingError
from app.rag.llm import LLMError
from app.ratelimit import limiter
from app.schemas.chat import (ChatRequest, ChatResponse, ConversationDetail, ConversationOut, MessageOut, SourceOut)

log = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
@limiter.limit("30/minute")
async def chat(request: Request, body: ChatRequest, session: AsyncSession = Depends(get_session)) -> ChatResponse:
    settings = get_settings()
    conversation: Conversation | None = None
    history: list[tuple[str, str]] = []
    if body.conversation_id:
        conversation = await session.get(Conversation, body.conversation_id)
        if conversation is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found.")
        recent = await session.scalars(
            select(Message).where(Message.conversation_id == conversation.id).order_by(Message.created_at.desc(), Message.role.asc()).limit(settings.history_messages)
        )
        history = [(m.role, m.content) for m in reversed(list(recent))]

    try:
        answer = await answer_question(session, body.message, history=history, document_ids=body.document_ids)
    except (EmbeddingError, LLMError) as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc

    # Persist only after a successful answer, so a failed call leaves no half-saved turn behind.
    if conversation is None:
        conversation = Conversation(title=body.message.strip()[:60])
        session.add(conversation)
        await session.flush()
    session.add(Message(conversation_id=conversation.id, role="user", content=body.message))
    reply = Message(conversation_id=conversation.id, role="assistant", content=answer.text)
    session.add(reply)
    await session.flush()
    session.add_all(
        Source(message_id=reply.id, document_id=s.document_id, page_number=s.page_number, chunk_id=s.chunk_id,
               relevance_score=s.score, label=s.label)
        for s in answer.sources
    )
    await session.commit()
    return ChatResponse(
        conversation_id=conversation.id, message_id=reply.id, answer=answer.text, refused=answer.refused,
        rewritten_question=answer.rewritten_question, tool_used=answer.tool_used, sources=[SourceOut(**s.__dict__) for s in answer.sources],
    )


@router.get("/history", response_model=list[ConversationOut])
async def chat_history(session: AsyncSession = Depends(get_session)) -> list[ConversationOut]:
    counts = select(Message.conversation_id, func.count().label("n")).group_by(Message.conversation_id).subquery()
    rows = await session.execute(
        select(Conversation, func.coalesce(counts.c.n, 0)).outerjoin(counts, counts.c.conversation_id == Conversation.id)
        .order_by(Conversation.created_at.desc()).limit(200)
    )
    return [ConversationOut(id=c.id, title=c.title, created_at=c.created_at, message_count=n) for c, n in rows]


@router.delete("/history", status_code=status.HTTP_204_NO_CONTENT)
async def clear_history(session: AsyncSession = Depends(get_session)) -> Response:
    await session.execute(delete(Conversation))
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(conversation_id: uuid.UUID, session: AsyncSession = Depends(get_session)) -> ConversationDetail:
    conv = await session.get(Conversation, conversation_id)
    if conv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found.")
    messages = list(await session.scalars(select(Message).where(Message.conversation_id == conv.id).order_by(Message.created_at, Message.role.desc())))
    src_rows = await session.execute(
        select(Source, Document.title, Document.filename, DocumentChunk.content, DocumentChunk.section)
        .join(Document, Document.id == Source.document_id).outerjoin(DocumentChunk, DocumentChunk.id == Source.chunk_id)
        .where(Source.message_id.in_([m.id for m in messages])).order_by(Source.label)
    )
    by_message: dict[uuid.UUID, list[SourceOut]] = {}
    for s, title, filename, content, section in src_rows:
        by_message.setdefault(s.message_id, []).append(SourceOut(
            label=s.label or 0, document_id=s.document_id, document_name=title or filename, page_number=s.page_number,
            section=section, chunk_id=s.chunk_id, score=s.relevance_score, snippet=content[:240] if content else None))
    return ConversationDetail(
        id=conv.id, title=conv.title, created_at=conv.created_at,
        messages=[MessageOut(id=m.id, role=m.role, content=m.content, created_at=m.created_at, sources=by_message.get(m.id, [])) for m in messages],
    )


@router.delete("/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(conversation_id: uuid.UUID, session: AsyncSession = Depends(get_session)) -> Response:
    conv = await session.get(Conversation, conversation_id)
    if conv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found.")
    await session.delete(conv)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
