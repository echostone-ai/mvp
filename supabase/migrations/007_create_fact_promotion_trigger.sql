-- Migration: Create fact promotion trigger for automatic fact extraction
-- This trigger automatically queues fact promotion when new memory fragments are inserted
-- Requirements: 9.1, 9.7

-- Create a table to queue fact promotion jobs
CREATE TABLE public.fact_promotion_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fragment_id UUID NOT NULL REFERENCES public.memory_fragments(id) ON DELETE CASCADE,
    avatar_id UUID NOT NULL REFERENCES public.avatar_profiles(id) ON DELETE CASCADE,
    fragment_text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    processing_time_ms INTEGER
);

-- Create indexes for efficient querying
CREATE INDEX fact_promotion_queue_status_idx ON public.fact_promotion_queue(status);
CREATE INDEX fact_promotion_queue_avatar_idx ON public.fact_promotion_queue(avatar_id);
CREATE INDEX fact_promotion_queue_created_at_idx ON public.fact_promotion_queue(created_at);
CREATE INDEX fact_promotion_queue_fragment_idx ON public.fact_promotion_queue(fragment_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.fact_promotion_queue ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for service-level access only
-- Only the service role can manage the promotion queue
CREATE POLICY "Service role can manage fact_promotion_queue" ON public.fact_promotion_queue
    FOR ALL USING (auth.role() = 'service_role');

-- Create function to queue fact promotion jobs
CREATE OR REPLACE FUNCTION queue_fact_promotion()
RETURNS TRIGGER AS $
BEGIN
    -- Only queue promotion for new memory fragments
    IF TG_OP = 'INSERT' THEN
        -- Insert a job into the promotion queue
        INSERT INTO public.fact_promotion_queue (
            fragment_id,
            avatar_id,
            fragment_text,
            status
        ) VALUES (
            NEW.id,
            NEW.avatar_id,
            NEW.content,
            'pending'
        );
        
        -- Log the queued job for monitoring
        RAISE LOG 'Queued fact promotion job for fragment % avatar %', NEW.id, NEW.avatar_id;
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$ language 'plpgsql';

-- Create trigger to automatically queue fact promotion on memory fragment insert
CREATE TRIGGER queue_fact_promotion_on_fragment_insert
    AFTER INSERT ON public.memory_fragments
    FOR EACH ROW
    EXECUTE FUNCTION queue_fact_promotion();

-- Create function to get pending promotion jobs (for background processing)
CREATE OR REPLACE FUNCTION get_pending_promotion_jobs(batch_size INTEGER DEFAULT 10)
RETURNS TABLE (
    id UUID,
    fragment_id UUID,
    avatar_id UUID,
    fragment_text TEXT,
    attempts INTEGER,
    created_at TIMESTAMPTZ
) AS $
BEGIN
    RETURN QUERY
    SELECT 
        q.id,
        q.fragment_id,
        q.avatar_id,
        q.fragment_text,
        q.attempts,
        q.created_at
    FROM public.fact_promotion_queue q
    WHERE q.status = 'pending'
       OR (q.status = 'failed' AND q.attempts < q.max_attempts)
    ORDER BY q.created_at ASC
    LIMIT batch_size;
END;
$ language 'plpgsql';

-- Create function to mark promotion job as processing
CREATE OR REPLACE FUNCTION start_promotion_job(job_id UUID)
RETURNS BOOLEAN AS $
BEGIN
    UPDATE public.fact_promotion_queue
    SET 
        status = 'processing',
        started_at = NOW(),
        attempts = attempts + 1
    WHERE id = job_id
      AND status IN ('pending', 'failed');
    
    RETURN FOUND;
END;
$ language 'plpgsql';

-- Create function to mark promotion job as completed
CREATE OR REPLACE FUNCTION complete_promotion_job(
    job_id UUID,
    processing_time_ms INTEGER DEFAULT NULL
)
RETURNS BOOLEAN AS $
BEGIN
    UPDATE public.fact_promotion_queue
    SET 
        status = 'completed',
        completed_at = NOW(),
        processing_time_ms = processing_time_ms,
        error_message = NULL
    WHERE id = job_id
      AND status = 'processing';
    
    RETURN FOUND;
END;
$ language 'plpgsql';

-- Create function to mark promotion job as failed
CREATE OR REPLACE FUNCTION fail_promotion_job(
    job_id UUID,
    error_msg TEXT
)
RETURNS BOOLEAN AS $
BEGIN
    UPDATE public.fact_promotion_queue
    SET 
        status = CASE 
            WHEN attempts >= max_attempts THEN 'failed'
            ELSE 'pending'
        END,
        error_message = error_msg,
        completed_at = CASE 
            WHEN attempts >= max_attempts THEN NOW()
            ELSE NULL
        END
    WHERE id = job_id
      AND status = 'processing';
    
    RETURN FOUND;
END;
$ language 'plpgsql';

-- Create function to clean up old completed jobs (for maintenance)
CREATE OR REPLACE FUNCTION cleanup_promotion_jobs(older_than_days INTEGER DEFAULT 7)
RETURNS INTEGER AS $
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.fact_promotion_queue
    WHERE status = 'completed'
      AND completed_at < NOW() - INTERVAL '1 day' * older_than_days;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE LOG 'Cleaned up % completed promotion jobs older than % days', deleted_count, older_than_days;
    
    RETURN deleted_count;
END;
$ language 'plpgsql';

-- Create function to get promotion queue statistics
CREATE OR REPLACE FUNCTION get_promotion_queue_stats()
RETURNS TABLE (
    pending_jobs INTEGER,
    processing_jobs INTEGER,
    completed_jobs INTEGER,
    failed_jobs INTEGER,
    avg_processing_time_ms NUMERIC,
    oldest_pending_job TIMESTAMPTZ
) AS $
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) FILTER (WHERE status = 'pending')::INTEGER as pending_jobs,
        COUNT(*) FILTER (WHERE status = 'processing')::INTEGER as processing_jobs,
        COUNT(*) FILTER (WHERE status = 'completed')::INTEGER as completed_jobs,
        COUNT(*) FILTER (WHERE status = 'failed')::INTEGER as failed_jobs,
        AVG(processing_time_ms) FILTER (WHERE status = 'completed' AND processing_time_ms IS NOT NULL) as avg_processing_time_ms,
        MIN(created_at) FILTER (WHERE status = 'pending') as oldest_pending_job
    FROM public.fact_promotion_queue;
END;
$ language 'plpgsql';

-- Add helpful comments for documentation
COMMENT ON TABLE public.fact_promotion_queue IS 'Queue for background fact promotion jobs triggered by new memory fragments';
COMMENT ON COLUMN public.fact_promotion_queue.status IS 'Job status: pending, processing, completed, or failed';
COMMENT ON COLUMN public.fact_promotion_queue.attempts IS 'Number of processing attempts for this job';
COMMENT ON COLUMN public.fact_promotion_queue.max_attempts IS 'Maximum number of retry attempts before marking as permanently failed';
COMMENT ON COLUMN public.fact_promotion_queue.processing_time_ms IS 'Time taken to process the job in milliseconds';

COMMENT ON FUNCTION queue_fact_promotion() IS 'Trigger function that queues fact promotion jobs when memory fragments are inserted';
COMMENT ON FUNCTION get_pending_promotion_jobs(INTEGER) IS 'Returns batch of pending promotion jobs for background processing';
COMMENT ON FUNCTION start_promotion_job(UUID) IS 'Marks a promotion job as processing and increments attempt counter';
COMMENT ON FUNCTION complete_promotion_job(UUID, INTEGER) IS 'Marks a promotion job as completed with optional processing time';
COMMENT ON FUNCTION fail_promotion_job(UUID, TEXT) IS 'Marks a promotion job as failed with error message';
COMMENT ON FUNCTION cleanup_promotion_jobs(INTEGER) IS 'Removes old completed promotion jobs for maintenance';
COMMENT ON FUNCTION get_promotion_queue_stats() IS 'Returns statistics about the promotion queue for monitoring';