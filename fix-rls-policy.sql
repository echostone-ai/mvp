-- Fix RLS Policy for Fact Promotion Queue
-- Run this in Supabase SQL Editor

-- Drop the existing policy
DROP POLICY IF EXISTS "Service role can manage fact_promotion_queue" ON public.fact_promotion_queue;

-- Create a more permissive policy that allows both service_role and authenticated users
CREATE POLICY "Allow fact promotion queue access" ON public.fact_promotion_queue
    FOR ALL USING (
        auth.role() = 'service_role' OR 
        auth.role() = 'authenticated' OR
        auth.uid() IS NOT NULL
    );

-- Also ensure the table has proper grants
GRANT ALL ON public.fact_promotion_queue TO authenticated;
GRANT ALL ON public.fact_promotion_queue TO service_role;