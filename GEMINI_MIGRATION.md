# FinSight AI — Gemini provider update

This patch switches the backend chat and embedding clients from the OpenAI SDK to Google's official `google-genai` SDK.

## Files changed

- `backend/app/config.py`: adds `GEMINI_API_KEY` settings.
- `backend/app/rag/llm.py`: uses Gemini `generate_content` for chat.
- `backend/app/rag/embeddings.py`: uses Gemini `embed_content` and validates output dimensions.
- `backend/app/rag/ingestion.py`: embeds indexed chunks with `RETRIEVAL_DOCUMENT`.
- `backend/app/rag/retriever.py`: embeds search queries with `RETRIEVAL_QUERY`.
- `backend/requirements.txt`: adds `google-genai` and removes `openai`.
- Backend tests and README updated for the Gemini provider.

## Local `.env`

Keep your existing API key. Ensure these variables are present:

```ini
GEMINI_API_KEY=your_existing_gemini_api_key
LLM_MODEL=gemini-3.5-flash-lite
EMBEDDING_MODEL=gemini-embedding-001
EMBEDDING_DIMENSIONS=1536
EMBEDDING_BATCH_SIZE=64
```

Do not paste the real key into chat, source control, or screenshots. `OPENAI_BASE_URL` is no longer used and can be removed from `.env` if desired. The patch archive intentionally does not include `.env`.

## Apply and rebuild

1. Extract this patch into the root of your existing `financial-report-agent` folder and allow it to overwrite the matching files.
2. Keep your existing `.env`, `data` directory, and Docker volumes untouched.
3. From the project root, rebuild only the backend:

```powershell
docker compose up -d --build backend
```

4. Check health:

```powershell
Invoke-RestMethod http://localhost:8000/api/health
```

5. Check backend logs:

```powershell
docker compose logs --tail=100 backend
```

6. In the Documents page, click the retry/reprocess control on the Meridian report. Alternatively, use the existing API endpoint `POST /api/documents/{document_id}/process` with its document ID.

7. Verify chunks and vectors:

```powershell
docker compose exec db psql -U finsight -d finsight -c "SELECT COUNT(*) AS total_chunks, COUNT(embedding) AS embedded_chunks FROM document_chunks;"
```

The existing database column is `vector(1536)`. The code requests 1536-dimensional Gemini embeddings and fails safely if the API returns a different size. It does not drop, recreate, or migrate the database.

## Important notes

- Gemini's `gemini-embedding-001` uses task types: `RETRIEVAL_DOCUMENT` for indexed chunks and `RETRIEVAL_QUERY` for user questions.
- Existing documents should be reprocessed after the provider switch so all vectors are generated in the same Gemini embedding space. Your current database check showed zero chunks, so there are no existing vectors to migrate at this point.
- PDF extraction and stored document metadata are not deleted by this change.
- Do not run `docker compose down -v`, `TRUNCATE`, or `DROP` commands.

## Validation status

Python source files passed `compileall` syntax compilation in the patching environment. Full pytest and live Gemini API checks could not be run in that environment because it lacked the project's `asyncpg` dependency and network access. Run the project's tests and the live checks in your local Docker environment after rebuilding.
