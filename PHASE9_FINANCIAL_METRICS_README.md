# FinSight AI — Phase 9 Financial Metrics patch

This patch extends the Phase 8 project. It does not change database schemas or remove existing records.

## Changes
- Adds conservative numeric extraction from existing PDF table rows (`backend/app/services/metric_extraction.py`).
- During document processing, recognized line items are saved to the existing `financial_metrics` table with document ID, period, and source page.
- Adds `GET /api/financials/documents` and `GET /api/financials/metrics?document_id=<uuid>`.
- Adds the Financial Metrics React page with KPI cards, period chart, and source-page table.

## Apply
1. Back up the project folder (do not remove Docker volumes).
2. Copy the contents of this archive over the existing project, allowing the changed files to be replaced. Keep your existing `.env` file.
3. From the project root run:

   ```powershell
   docker compose up -d --build backend frontend
   ```

4. Existing uploaded PDFs are not automatically reprocessed. To populate metrics for an already-uploaded document, open Swagger at `http://localhost:8000/docs`, find `POST /api/documents/{document_id}/process`, and submit the document UUID. This reprocesses that document's extracted pages/tables/chunks; the existing ingestion pipeline reuses matching embeddings where possible. Do not delete the database or Docker volume.
5. Open `http://localhost:5173/metrics`.

## Extraction limitations
The parser is intentionally conservative and currently recognizes common English financial statement labels when the label is in the first column and numeric values are in subsequent columns. It does not use an LLM to invent missing numbers. If a PDF table has merged cells, scanned images, unusual labels, or values not extracted by `pdfplumber`, the page can show no metrics; the original document and RAG data remain available.

## Validation
- Python source files pass `python -m compileall`.
- Frontend build was not validated in this environment because `npm ci` did not complete before the execution timeout. Run `npm ci` and `npm run build` locally if the frontend reports a compile error.
