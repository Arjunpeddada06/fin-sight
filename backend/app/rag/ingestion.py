"""Document ingestion pipeline. Runs in the background so uploads return immediately.

Stages: processing -> extracting -> (embedding: Phase 4) -> ready. Any failure stores a readable error and sets 'failed'.
"""
import asyncio
import logging
import uuid

from sqlalchemy import delete, select

from app.database import SessionLocal
from app.models import Document, DocumentChunk, DocumentPage, DocumentStatus, FinancialTable, FinancialMetric
from app.services.metric_extraction import extract_metrics
from app.rag.chunking import Chunk, build_chunks
from app.rag.embeddings import EmbeddingError, get_embedder
from app.services.pdf_service import PDFError, extract_pages, guess_metadata
from app.services.table_service import extract_tables

log = logging.getLogger(__name__)


async def _set_status(session, doc: Document, status: DocumentStatus, error: str | None = None) -> None:
    doc.status, doc.error = status, error
    await session.commit()


async def _embed_with_reuse(session, chunks: list[Chunk]) -> list[list[float]]:
    """Embed chunk texts, reusing stored vectors for identical text (re-processing and duplicate content cost nothing)."""
    contents = list({c.content for c in chunks})
    known: dict[str, list[float]] = {}
    if contents:
        rows = await session.execute(
            select(DocumentChunk.content, DocumentChunk.embedding).where(
                DocumentChunk.content.in_(contents), DocumentChunk.embedding.isnot(None)
            )
        )
        known = {content: [float(x) for x in emb] for content, emb in rows}
    missing = [c for c in contents if c not in known]
    if missing:
        known.update(zip(missing, await get_embedder().embed(missing, task_type="RETRIEVAL_DOCUMENT")))
        log.info("Embedded %d new texts, reused %d", len(missing), len(contents) - len(missing))
    return [known[c.content] for c in chunks]


async def process_document(document_id: uuid.UUID) -> None:
    async with SessionLocal() as session:
        doc = await session.get(Document, document_id)
        if doc is None:
            return
        try:
            await _set_status(session, doc, DocumentStatus.processing)

            await _set_status(session, doc, DocumentStatus.extracting)
            # PyMuPDF / pdfplumber are blocking: keep them off the event loop.
            pages = await asyncio.to_thread(extract_pages, doc.file_path)
            tables = await asyncio.to_thread(extract_tables, doc.file_path, {p.page_number: p.text for p in pages})

            # Re-processing replaces earlier results.
            await session.execute(delete(DocumentPage).where(DocumentPage.document_id == doc.id))
            await session.execute(delete(FinancialTable).where(FinancialTable.document_id == doc.id))
            await session.execute(delete(FinancialMetric).where(FinancialMetric.document_id == doc.id))
            session.add_all(DocumentPage(document_id=doc.id, page_number=p.page_number, text=p.text) for p in pages)
            session.add_all(
                FinancialTable(document_id=doc.id, page_number=t.page_number, table_type=t.table_type, title=t.title,
                               data={"columns": t.columns, "rows": t.rows}, markdown=t.markdown)
                for t in tables
            )
            extracted_metrics = []
            for table in tables:
                for item in extract_metrics({"columns": table.columns, "rows": table.rows}, doc.fiscal_year):
                    extracted_metrics.append(FinancialMetric(
                        document_id=doc.id, metric_name=item["metric_name"], period=item["period"],
                        value=item["value"], page_number=table.page_number, currency=None, unit=None,
                    ))
            if extracted_metrics:
                session.add_all(extracted_metrics)
            meta = guess_metadata(pages)
            doc.page_count = len(pages)
            doc.company = doc.company or meta["company"]
            doc.fiscal_year = doc.fiscal_year or meta["fiscal_year"]
            doc.report_type = doc.report_type or meta["report_type"]
            await session.commit()

            await _set_status(session, doc, DocumentStatus.embedding)
            chunks = build_chunks(pages, tables)
            vectors = await _embed_with_reuse(session, chunks)
            # Old chunks are replaced only after new vectors exist, so a failed embedding never loses data.
            await session.execute(delete(DocumentChunk).where(DocumentChunk.document_id == doc.id))
            session.add_all(
                DocumentChunk(document_id=doc.id, page_number=c.page_number, section=c.section, chunk_index=c.chunk_index,
                              content=c.content, token_count=c.token_count, embedding=v, meta=c.meta)
                for c, v in zip(chunks, vectors)
            )
            await session.commit()
            await _set_status(session, doc, DocumentStatus.ready)
            log.info("Document %s ready: %d pages, %d tables, %d chunks", doc.id, len(pages), len(tables), len(chunks))
        except EmbeddingError as exc:
            await session.rollback()  # extracted pages and tables were already committed and are kept
            await _set_status(session, doc, DocumentStatus.failed, f"Text was extracted, but embedding failed: {exc}")
        except PDFError as exc:
            await session.rollback()
            await _set_status(session, doc, DocumentStatus.failed, str(exc))
        except Exception:
            log.exception("Ingestion failed for %s", document_id)
            await session.rollback()
            await _set_status(session, doc, DocumentStatus.failed, "Processing failed unexpectedly. Try uploading again.")
