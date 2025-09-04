-- Fix RLS Policy for fact_promotion_queue - Service Role Only
-- Apply exactly once to prevent RLS violations

-- Enable RLS if not already enabled
ALTER TABLE public.fact_promotion_queue ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start clean
DROP POLICY IF EXISTS "service_role_full_access" ON public.fact_promotion_queue;
DROP POLICY IF EXISTS "Service role can manage fact_promotion_queue" ON public.fact_promotion_queue;
DROP POLICY IF EXISTS "Users can manage their own fact promotion queue" ON public.fact_promotion_queue;
DROP POLICY IF EXISTS "Allow fact promotion access" ON public.fact_promotion_queue;

-- Create single service role policy
CREATE POLICY "service_role_full_access" ON public.fact_promotion_queue
    FOR ALL 
    USING (auth.role() = 'service_role') 
    WITH CHECK (auth.role() = 'service_role');

-- Grant permissions to service role
GRANT ALL ON public.fact_promotion_queue TO service_role;

-- Verify the policy is working
DO $$
BEGIN
    -- Test that the policy exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'fact_promotion_queue' 
        AND policyname = 'service_role_full_access'
    ) THEN
        RAISE EXCEPTION 'RLS policy was not created successfully';
    END IF;
    
    RAISE NOTICE 'RLS policy applied successfully for fact_promotion_queue';
END $$;