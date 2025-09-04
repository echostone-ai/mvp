-- Add temporal context to quick_facts table
ALTER TABLE quick_facts 
ADD COLUMN IF NOT EXISTS fact_type text CHECK (fact_type IN ('current', 'historical', 'critical')) DEFAULT 'current',
ADD COLUMN IF NOT EXISTS time_context jsonb DEFAULT '{}';

-- Update existing facts to have proper temporal context
UPDATE quick_facts 
SET fact_type = 'current' 
WHERE fact_type IS NULL;

-- Set critical facts that should always be included
UPDATE quick_facts 
SET fact_type = 'critical' 
WHERE key IN ('given_name', 'full_name', 'birth_date', 'birth_year', 'profession', 'birthplace');

-- Set historical facts
UPDATE quick_facts 
SET fact_type = 'historical',
    time_context = '{"start": "1999", "end": "2009"}'
WHERE key = 'marriage_history';

-- Set current relationship status
UPDATE quick_facts 
SET fact_type = 'current',
    time_context = '{"since": "2023"}'
WHERE key = 'partner_name';

-- Add proper marriage historical fact
INSERT INTO quick_facts (avatar_id, key, value, fact_type, time_context, priority, confidence, source, source_reference)
VALUES (
    '0585f43b-4b49-4e16-b2a7-91c8e1e3850c',
    'marriage_tia',
    'Married to Tia (first girlfriend) for 10 years',
    'historical',
    '{"start": "1999", "end": "2009", "duration": "10 years"}',
    1,
    0.95,
    'manual',
    'temporal-fix'
) ON CONFLICT DO NOTHING;

-- Update current relationship to be clearer
UPDATE quick_facts 
SET value = 'Krissy',
    fact_type = 'current',
    time_context = '{"since": "2023"}'
WHERE key = 'partner_name' 
AND avatar_id = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';