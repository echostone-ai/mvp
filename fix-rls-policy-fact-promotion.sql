-- Fix RLS Policy for Fact Promotion Queue
-- Allow service-role and authenticated users to manage fact_promotion_queue

DROP POLICY IF EXISTS "Service role can manage fact_promotion_queue" ON public.fact_promotion_queue;

CREATE POLICY "Service role can manage fact_promotion_queue" ON public.fact_promotion_queue
    FOR ALL USING (
        auth.role() = 'service_role' OR 
        auth.role() = 'authenticated'
    );

-- Also ensure the table exists and RLS is enabled
ALTER TABLE public.fact_promotion_queue ENABLE ROW LEVEL SECURITY;