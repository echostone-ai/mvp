-- RLS Policy for fact_promotion_queue - Service Role Only Access
-- Implements requirement 4: Ensure all writes use service-role client

-- Enable RLS on the table
ALTER TABLE public.fact_promotion_queue ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "service_role_full_access" ON public.fact_promotion_queue;
DROP POLICY IF EXISTS "Service role can manage fact_promotion_queue" ON public.fact_promotion_queue;
DROP POLICY IF EXISTS "Users can manage their own fact promotion queue" ON public.fact_promotion_queue;
DROP POLICY IF EXISTS "Allow fact promotion access" ON public.fact_promotion_queue;

-- Create the exact policy specified in requirements
CREATE POLICY "service_role_full_access"
ON public.fact_promotion_queue
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Grant permissions to service role
GRANT ALL ON public.fact_promotion_queue TO service_role;

-- Verify the policy is active
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'fact_promotion_queue';