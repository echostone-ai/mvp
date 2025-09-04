## Deployment Guide

### Database migrations
- Apply in this order:
  1. `supabase/migrations/007_create_fact_promotion_trigger.sql`
  2. `supabase/migrations/008_create_quick_facts_functions.sql`
  3. `009_extraction_metrics.sql` (extraction metrics) — ensure this migration exists in your environment
  4. `010_trgm_indexes.sql` (PG Trigram indexes) — ensure this migration exists in your environment

Example (Supabase CLI):
```bash
supabase db reset --db-url "$SUPABASE_DB_URL" # optional for fresh env
supabase db execute --file supabase/migrations/007_create_fact_promotion_trigger.sql --db-url "$SUPABASE_DB_URL"
supabase db execute --file supabase/migrations/008_create_quick_facts_functions.sql --db-url "$SUPABASE_DB_URL"
supabase db execute --file supabase/migrations/009_extraction_metrics.sql --db-url "$SUPABASE_DB_URL"
supabase db execute --file supabase/migrations/010_trgm_indexes.sql --db-url "$SUPABASE_DB_URL"
```

### Environment variables
- LLM:
  - `OPENAI_API_KEY` (required)
  - `OPENAI_MODEL` (optional; defaults to `gpt-4o-mini` where used)
- Supabase (server):
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
- Supabase (client/public):
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Notes:
- Some endpoints may read `NEXT_PUBLIC_OPENAI_API_KEY` as a fallback in dev.
- Ensure server-only keys are not exposed to the browser.

### Background worker (Fact Promotion)
- A background processor handles promotion of extracted facts into `quick_facts` and related tables.
- Configuration (env overrides):
  - `FACT_PROMOTION_ENABLED` (default: true)
  - `FACT_PROMOTION_BATCH_SIZE` (default: 10)
  - `FACT_PROMOTION_INTERVAL_MS` (default: 1000)
  - `FACT_PROMOTION_MAX_CONCURRENT` (default: 5)
  - `FACT_PROMOTION_ENABLE_RETRIES` (default: true)
  - `FACT_PROMOTION_MAX_RETRIES` (default: 3)
  - `FACT_PROMOTION_TIMEOUT_MS` (default: 5000)
- Ensure the worker process is started alongside the web app. The service initializes on demand in API routes that add memories, but for production prefer a dedicated worker process to guarantee steady throughput.

### RLS and metrics
- Debug/metrics endpoints are dev-only; do not enable in production.
- For writing extraction/metrics in production, use an admin client (`SUPABASE_SERVICE_ROLE_KEY`) or create an RLS policy that permits owner writes, e.g., `owner_write_metrics` for a metrics table.

### Performance goals
- `quick_facts` fetch: < 100ms P50
- Fact promotion (from fragment insert to promoted fact): < 200ms per fragment (steady-state)
- Track via dev metrics endpoint and internal monitoring.
