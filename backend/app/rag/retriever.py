"""Hybrid retrieval: pgvector cosine search + PostgreSQL full-text search, fused with Reciprocal Rank Fusion."""
import re
import uuid
from dataclasses import dataclass, field

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.rag.embeddings import Embedder, get_embedder
from app.rag.reranker import reciprocal_rank_fusion

_STOP = {"the", "a", "an", "of", "and", "or", "in", "on", "to", "for", "is", "was", "what", "were", "how", "did", "by", "with", "at", "as"}
_COLS = """c.id, c.document_id, d.title, d.filename, c.page_number, c.section, c.content,
           c.metadata->>'kind' AS kind, 1 - (c.embedding <=> CAST(:qv AS vector)) AS sim"""


@dataclass
class SearchHit:
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    document_name: str
    page_number: int
    section: str | None
    content: str
    kind: str
    similarity: float | None
    score: float
    matched_by: list[str] = field(default_factory=list)


def keyword_tsquery(query: str) -> str | None:
    """'Revenue growth FY2025?' -> 'revenue | growth | fy2025' (OR semantics, injection-safe: alphanumerics only)."""
    terms = [t for t in re.findall(r"[A-Za-z0-9]+", query.lower()) if len(t) > 1 and t not in _STOP]
    return " | ".join(dict.fromkeys(terms)) or None


def _vec_literal(v: list[float]) -> str:
    return "[" + ",".join(f"{x:.7f}" for x in v) + "]"


def _filters(document_ids: list[uuid.UUID] | None, kind: str | None, params: dict) -> str:
    sql = ""
    if document_ids:
        sql += " AND c.document_id = ANY(:doc_ids)"
        params["doc_ids"] = document_ids
    if kind:
        sql += " AND c.metadata->>'kind' = :kind"
        params["kind"] = kind
    return sql


async def search_chunks(
    session: AsyncSession,
    queries: str | list[str],
    *,
    document_ids: list[uuid.UUID] | None = None,
    top_k: int = 5,
    kind: str | None = None,
    embedder: Embedder | None = None,
) -> list[SearchHit]:
    """Search with one or several query variants (multi-query); all result lists are fused together."""
    qs = [queries] if isinstance(queries, str) else list(queries)
    qs = [q.strip() for q in qs if q and q.strip()]
    if not qs:
        return []
    embedder = embedder or get_embedder()
    vectors = await embedder.embed(qs, task_type="RETRIEVAL_QUERY")
    pool = max(top_k * 4, 20)

    rows: dict[uuid.UUID, dict] = {}
    rankings: list[list[uuid.UUID]] = []
    origin: dict[uuid.UUID, set[str]] = {}

    for q, vec in zip(qs, vectors):
        params: dict = {"qv": _vec_literal(vec), "n": pool}
        flt = _filters(document_ids, kind, params)
        base = f"SELECT {_COLS} FROM document_chunks c JOIN documents d ON d.id = c.document_id"
        vec_rows = (await session.execute(
            text(f"{base} WHERE c.embedding IS NOT NULL{flt} ORDER BY c.embedding <=> CAST(:qv AS vector) LIMIT :n"), params
        )).mappings().all()
        rankings.append([r["id"] for r in vec_rows])
        for r in vec_rows:
            rows.setdefault(r["id"], dict(r)); origin.setdefault(r["id"], set()).add("vector")

        tsq = keyword_tsquery(q)
        if tsq:
            params2 = dict(params, tsq=tsq)
            kw_rows = (await session.execute(
                text(f"{base}, to_tsquery('english', :tsq) AS tq WHERE to_tsvector('english', c.content) @@ tq{flt} "
                     "ORDER BY ts_rank_cd(to_tsvector('english', c.content), tq) DESC LIMIT :n"), params2
            )).mappings().all()
            rankings.append([r["id"] for r in kw_rows])
            for r in kw_rows:
                rows.setdefault(r["id"], dict(r)); origin.setdefault(r["id"], set()).add("keyword")

    fused = reciprocal_rank_fusion(rankings)
    top = sorted(fused, key=fused.get, reverse=True)[:top_k]
    return [
        SearchHit(
            chunk_id=i, document_id=rows[i]["document_id"], document_name=rows[i]["title"] or rows[i]["filename"],
            page_number=rows[i]["page_number"], section=rows[i]["section"], content=rows[i]["content"],
            kind=rows[i]["kind"] or "text", similarity=None if rows[i]["sim"] is None else round(float(rows[i]["sim"]), 4),
            score=round(fused[i], 5), matched_by=sorted(origin[i]),
        )
        for i in top
    ]
