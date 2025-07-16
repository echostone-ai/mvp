-- Memory optimization SQL functions for enhanced performance

-- Fast approximate vector search using IVFFlat index
CREATE OR REPLACE FUNCTION match_memory_fragments_fast(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  user_id uuid
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  fragment_text text,
  embedding vector(1536),
  conversation_context jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mf.id,
    mf.user_id,
    mf.fragment_text,
    mf.embedding,
    mf.conversation_context,
    mf.created_at,
    mf.updated_at,
    1 - (mf.embedding <=> query_embedding) AS similarity
  FROM memory_fragments mf
  WHERE mf.user_id = match_memory_fragments_fast.user_id
    AND 1 - (mf.embedding <=> query_embedding) > match_threshold
  ORDER BY mf.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Exact vector search for high accuracy requirements
CREATE OR REPLACE FUNCTION match_memory_fragments_exact(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  user_id uuid
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  fragment_text text,
  embedding vector(1536),
  conversation_context jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mf.id,
    mf.user_id,
    mf.fragment_text,
    mf.embedding,
    mf.conversation_context,
    mf.created_at,
    mf.updated_at,
    1 - (mf.embedding <#> query_embedding) AS similarity -- Use exact dot product
  FROM memory_fragments mf
  WHERE mf.user_id = match_memory_fragments_exact.user_id
    AND 1 - (mf.embedding <#> query_embedding) > match_threshold
  ORDER BY mf.embedding <#> query_embedding
  LIMIT match_count;
END;
$$;

-- Get table statistics for optimization analysis
CREATE OR REPLACE FUNCTION get_table_stats(table_name text)
RETURNS TABLE (
  row_count bigint,
  table_size_mb numeric,
  index_size_mb numeric,
  total_size_mb numeric,
  last_vacuum timestamptz,
  last_analyze timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT reltuples::bigint FROM pg_class WHERE relname = table_name),
    (SELECT pg_size_pretty(pg_total_relation_size(table_name::regclass))::numeric),
    (SELECT pg_size_pretty(pg_indexes_size(table_name::regclass))::numeric),
    (SELECT pg_size_pretty(pg_total_relation_size(table_name::regclass) + pg_indexes_size(table_name::regclass))::numeric),
    (SELECT last_vacuum FROM pg_stat_user_tables WHERE relname = table_name),
    (SELECT last_analyze FROM pg_stat_user_tables WHERE relname = table_name);
END;
$$;

-- Get index usage statistics
CREATE OR REPLACE FUNCTION get_index_usage(table_name text)
RETURNS TABLE (
  indexname text,
  scans bigint,
  tuples_read bigint,
  tuples_fetched bigint,
  size_mb numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.indexname::text,
    s.idx_scan,
    s.idx_tup_read,
    s.idx_tup_fetch,
    pg_size_pretty(pg_relation_size(i.indexname::regclass))::numeric
  FROM pg_indexes i
  LEFT JOIN pg_stat_user_indexes s ON i.indexname = s.indexrelname
  WHERE i.tablename = table_name;
END;
$$;

-- Execute SQL for index creation (admin function)
CREATE OR REPLACE FUNCTION execute_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

-- Explain query for performance analysis
CREATE OR REPLACE FUNCTION explain_query(query_sql text, query_params jsonb DEFAULT '[]')
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  result text;
BEGIN
  -- This is a simplified version - in practice, you'd need more sophisticated parameter handling
  EXECUTE 'EXPLAIN (ANALYZE, BUFFERS) ' || query_sql INTO result;
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN 'Error executing query: ' || SQLERRM;
END;
$$;

-- Optimize memory fragments table maintenance
CREATE OR REPLACE FUNCTION optimize_memory_fragments_maintenance()
RETURNS TABLE (
  operation text,
  status text,
  details text
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Vacuum and analyze the table
  BEGIN
    VACUUM ANALYZE memory_fragments;
    RETURN QUERY SELECT 'VACUUM ANALYZE'::text, 'SUCCESS'::text, 'Table maintenance completed'::text;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY SELECT 'VACUUM ANALYZE'::text, 'ERROR'::text, SQLERRM::text;
  END;

  -- Update table statistics
  BEGIN
    ANALYZE memory_fragments;
    RETURN QUERY SELECT 'ANALYZE'::text, 'SUCCESS'::text, 'Statistics updated'::text;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY SELECT 'ANALYZE'::text, 'ERROR'::text, SQLERRM::text;
  END;

  -- Check for bloat and recommend reindex if needed
  BEGIN
    DECLARE
      bloat_ratio numeric;
    BEGIN
      SELECT 
        CASE 
          WHEN pg_stat_user_tables.n_dead_tup > 0 
          THEN pg_stat_user_tables.n_dead_tup::numeric / pg_stat_user_tables.n_tup_ins::numeric 
          ELSE 0 
        END INTO bloat_ratio
      FROM pg_stat_user_tables 
      WHERE relname = 'memory_fragments';
      
      IF bloat_ratio > 0.2 THEN
        RETURN QUERY SELECT 'BLOAT_CHECK'::text, 'WARNING'::text, 
          ('High bloat ratio detected: ' || bloat_ratio::text || '. Consider REINDEX.')::text;
      ELSE
        RETURN QUERY SELECT 'BLOAT_CHECK'::text, 'SUCCESS'::text, 
          ('Bloat ratio acceptable: ' || bloat_ratio::text)::text;
      END IF;
    END;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY SELECT 'BLOAT_CHECK'::text, 'ERROR'::text, SQLERRM::text;
  END;
END;
$$;

-- Get memory fragment statistics for a user
CREATE OR REPLACE FUNCTION get_user_memory_stats(target_user_id uuid)
RETURNS TABLE (
  total_fragments bigint,
  avg_fragment_length numeric,
  oldest_fragment timestamptz,
  newest_fragment timestamptz,
  fragments_last_30_days bigint,
  total_storage_size_mb numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_fragments,
    AVG(LENGTH(fragment_text))::numeric as avg_fragment_length,
    MIN(created_at) as oldest_fragment,
    MAX(created_at) as newest_fragment,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as fragments_last_30_days,
    (pg_column_size(array_agg(fragment_text)) + pg_column_size(array_agg(embedding)))::numeric / 1024 / 1024 as total_storage_size_mb
  FROM memory_fragments
  WHERE user_id = target_user_id;
END;
$$;

-- Batch cleanup of old or unused memory fragments
CREATE OR REPLACE FUNCTION cleanup_old_memory_fragments(
  days_old integer DEFAULT 365,
  batch_size integer DEFAULT 1000
)
RETURNS TABLE (
  deleted_count bigint,
  operation_status text
)
LANGUAGE plpgsql
AS $$
DECLARE
  total_deleted bigint := 0;
  batch_deleted bigint;
BEGIN
  LOOP
    -- Delete in batches to avoid long-running transactions
    DELETE FROM memory_fragments
    WHERE id IN (
      SELECT id FROM memory_fragments
      WHERE created_at < NOW() - (days_old || ' days')::interval
      LIMIT batch_size
    );
    
    GET DIAGNOSTICS batch_deleted = ROW_COUNT;
    total_deleted := total_deleted + batch_deleted;
    
    -- Exit if no more rows to delete
    EXIT WHEN batch_deleted = 0;
    
    -- Small delay between batches
    PERFORM pg_sleep(0.1);
  END LOOP;
  
  RETURN QUERY SELECT total_deleted, 'SUCCESS'::text;
EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT total_deleted, ('ERROR: ' || SQLERRM)::text;
END;
$$;

-- Create optimized indexes with proper parameters
CREATE OR REPLACE FUNCTION create_optimized_memory_indexes()
RETURNS TABLE (
  index_name text,
  status text,
  details text
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- User + created_at composite index
  BEGIN
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memory_fragments_user_created_optimized
    ON memory_fragments (user_id, created_at DESC);
    RETURN QUERY SELECT 'idx_memory_fragments_user_created_optimized'::text, 'SUCCESS'::text, 'Composite index created'::text;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY SELECT 'idx_memory_fragments_user_created_optimized'::text, 'ERROR'::text, SQLERRM::text;
  END;

  -- Partial index for recent memories
  BEGIN
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memory_fragments_recent_optimized
    ON memory_fragments (user_id, created_at)
    WHERE created_at > NOW() - INTERVAL '30 days';
    RETURN QUERY SELECT 'idx_memory_fragments_recent_optimized'::text, 'SUCCESS'::text, 'Partial index for recent memories created'::text;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY SELECT 'idx_memory_fragments_recent_optimized'::text, 'ERROR'::text, SQLERRM::text;
  END;

  -- Full-text search index
  BEGIN
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memory_fragments_fulltext_optimized
    ON memory_fragments USING gin(to_tsvector('english', fragment_text));
    RETURN QUERY SELECT 'idx_memory_fragments_fulltext_optimized'::text, 'SUCCESS'::text, 'Full-text search index created'::text;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY SELECT 'idx_memory_fragments_fulltext_optimized'::text, 'ERROR'::text, SQLERRM::text;
  END;

  -- Optimized vector index with better parameters
  BEGIN
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memory_fragments_embedding_hnsw
    ON memory_fragments USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
    RETURN QUERY SELECT 'idx_memory_fragments_embedding_hnsw'::text, 'SUCCESS'::text, 'HNSW vector index created'::text;
  EXCEPTION
    WHEN OTHERS THEN
      -- Fallback to IVFFlat if HNSW is not available
      BEGIN
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memory_fragments_embedding_ivfflat_optimized
        ON memory_fragments USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 200);
        RETURN QUERY SELECT 'idx_memory_fragments_embedding_ivfflat_optimized'::text, 'SUCCESS'::text, 'IVFFlat vector index created (HNSW fallback)'::text;
      EXCEPTION
        WHEN OTHERS THEN
          RETURN QUERY SELECT 'idx_memory_fragments_embedding_optimized'::text, 'ERROR'::text, SQLERRM::text;
      END;
  END;
END;
$$;

-- Performance monitoring function
CREATE OR REPLACE FUNCTION get_memory_performance_metrics()
RETURNS TABLE (
  metric_name text,
  metric_value numeric,
  metric_unit text,
  last_updated timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Table size metrics
  RETURN QUERY
  SELECT 
    'table_size_mb'::text,
    (pg_total_relation_size('memory_fragments'::regclass) / 1024 / 1024)::numeric,
    'MB'::text,
    NOW();

  -- Index size metrics
  RETURN QUERY
  SELECT 
    'index_size_mb'::text,
    (pg_indexes_size('memory_fragments'::regclass) / 1024 / 1024)::numeric,
    'MB'::text,
    NOW();

  -- Row count
  RETURN QUERY
  SELECT 
    'total_rows'::text,
    (SELECT reltuples FROM pg_class WHERE relname = 'memory_fragments')::numeric,
    'rows'::text,
    NOW();

  -- Average query time (from pg_stat_statements if available)
  BEGIN
    RETURN QUERY
    SELECT 
      'avg_query_time_ms'::text,
      (SELECT mean_exec_time FROM pg_stat_statements 
       WHERE query LIKE '%memory_fragments%' 
       ORDER BY calls DESC LIMIT 1)::numeric,
      'ms'::text,
      NOW();
  EXCEPTION
    WHEN OTHERS THEN
      RETURN QUERY
      SELECT 
        'avg_query_time_ms'::text,
        NULL::numeric,
        'ms'::text,
        NOW();
  END;

  -- Cache hit ratio
  RETURN QUERY
  SELECT 
    'cache_hit_ratio'::text,
    (SELECT 
      CASE 
        WHEN heap_blks_read + heap_blks_hit > 0 
        THEN (heap_blks_hit::numeric / (heap_blks_read + heap_blks_hit)) * 100
        ELSE 0 
      END
     FROM pg_statio_user_tables 
     WHERE relname = 'memory_fragments')::numeric,
    'percent'::text,
    NOW();
END;
$$;