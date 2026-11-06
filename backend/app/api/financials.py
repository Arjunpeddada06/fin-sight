from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_session
from app.models import Document, FinancialMetric

router = APIRouter(prefix="/financials", tags=["financials"])

@router.get("/metrics")
async def list_financial_metrics(document_id: UUID | None = Query(default=None), session: AsyncSession = Depends(get_session)):
    stmt = select(FinancialMetric, Document.filename, Document.company).join(Document, Document.id == FinancialMetric.document_id)
    if document_id:
        stmt = stmt.where(FinancialMetric.document_id == document_id)
    stmt = stmt.order_by(Document.created_at.desc(), FinancialMetric.period, FinancialMetric.metric_name)
    rows = (await session.execute(stmt)).all()
    return [{"id": str(m.id), "document_id": str(m.document_id), "filename": filename,
             "company": company, "metric_name": m.metric_name, "period": m.period,
             "value": m.value, "unit": m.unit, "currency": m.currency, "page_number": m.page_number}
            for m, filename, company in rows]

@router.get("/documents")
async def financial_documents(session: AsyncSession = Depends(get_session)):
    stmt = select(Document).where(Document.status == "ready").order_by(Document.created_at.desc())
    docs = (await session.scalars(stmt)).all()
    return [{"id": str(d.id), "filename": d.filename, "company": d.company,
             "fiscal_year": d.fiscal_year, "report_type": d.report_type} for d in docs]
