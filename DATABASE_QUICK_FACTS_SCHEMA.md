# Quick Facts Database Schema

This document describes the database schema for the Hot Facts Extraction & Persona Pipeline, which provides a "hot tier" of essential identity facts for avatars.

## Overview

The schema consists of four main tables and supporting functions:

1. **`quick_facts`** - Stores key identity facts for avatars
2. **`fact_history`** - Audit trail for all fact changes
3. **`fact_promotion_queue`** - Queue for processing fact extraction from memory fragments
4. **Helper functions** - Optimized access patterns and utilities

## Tables

### quick_facts

Stores key identity facts that are always injected into avatar prompts to prevent hallucination.

```sql
CREATE TABLE public.quick_facts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    avatar_id UUID NOT NULL REFERENCES public.avatar_profiles(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    confidence FLOAT DEFAULT 1.0 CHECK (confidence >= 0.0 AND confidence <= 1.0),
    priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    source TEXT DEFAULT 'extraction' CHECK (source IN ('heuristic', 'llm', 'manual', 'extraction')),
    source_reference TEXT,
    date_context JSONB,
    expires_at TIMESTAMPTZ,
    media_reference TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (avatar_id, key)
);
```

**Key Fields:**
- `priority`: 1=highest (core identity), 10=lowest (trivia)
- `confidence`: 0.0 to 1.0 accuracy score
- `date_context`: JSON with year, month, day for time-stamped events
- `expires_at`: Optional expiration for facts that become outdated

**Indexes:**
- `quick_facts_avatar_idx` - Fast avatar lookups
- `quick_facts_priority_idx` - Priority-based filtering
- `quick_facts_key_idx` - Key-based searches
- `quick_facts_expires_at_idx` - Expiration handling

### fact_history

Maintains an audit trail of all changes to quick_facts for debugging and analysis.

```sql
CREATE TABLE public.fact_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    avatar_id UUID NOT NULL REFERENCES public.avatar_profiles(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT NOT NULL,
    old_confidence FLOAT,
    new_confidence FLOAT NOT NULL,
    old_priority INTEGER,
    new_priority INTEGER NOT NULL,
    change_type TEXT NOT NULL CHECK (change_type IN ('insert', 'update', 'delete')),
    change_source TEXT DEFAULT 'conversation',
    source_reference TEXT,
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    changed_by TEXT
);
```

**Automatic Logging:**
- All INSERT, UPDATE, DELETE operations on `quick_facts` are automatically logged
- Triggered by `log_quick_facts_changes` trigger

### fact_promotion_queue

Queues fact promotion jobs when new memory fragments are inserted.

```sql
CREATE TABLE public.fact_promotion_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    avatar_id UUID NOT NULL REFERENCES public.avatar_profiles(id) ON DELETE CASCADE,
    fragment_id UUID NOT NULL REFERENCES public.memory_fragments(id) ON DELETE CASCADE,
    fragment_text TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    attempts INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    UNIQUE (fragment_id)
);
```

**Automatic Queuing:**
- Triggered by `queue_fact_promotion_on_insert` when memory fragments are inserted
- Prevents duplicate queue entries for the same fragment

## Functions

### fetch_quick_facts(avatar_id, max_priority, include_expired)

Fetches quick facts with priority filtering and expiration handling.

```sql
SELECT * FROM public.fetch_quick_facts(
    '550e8400-e29b-41d4-a716-446655440000'::UUID,
    5,     -- max_priority (1-10)
    false  -- include_expired
);
```

### fetch_style_profile(avatar_id)

Fetches speaking style and personality facts for prompt building.

```sql
SELECT * FROM public.fetch_style_profile('550e8400-e29b-41d4-a716-446655440000'::UUID);
```

Returns:
- `speaking_style`
- `humor_style` 
- `emotional_expression`
- `signature_phrases`

### upsert_quick_fact(...)

Inserts or updates a quick fact with validation.

```sql
SELECT public.upsert_quick_fact(
    '550e8400-e29b-41d4-a716-446655440000'::UUID, -- avatar_id
    'birth_year',                                   -- key
    '1985',                                        -- value
    0.95,                                          -- confidence
    2,                                             -- priority
    'heuristic',                                   -- source
    'From seed text',                              -- source_reference
    '{"year": 1985}'::jsonb,                      -- date_context
    NULL                                           -- expires_at
);
```

### get_fact_statistics(avatar_id)

Returns statistics about an avatar's facts for debugging.

```sql
SELECT * FROM public.get_fact_statistics('550e8400-e29b-41d4-a716-446655440000'::UUID);
```

Returns:
- `total_facts`
- `core_identity_facts` (priority <= 2)
- `style_facts` (priority = 1)
- `life_context_facts` (priority 3-5)
- `expired_facts`
- `avg_confidence`
- `last_updated`

## Security

### Row Level Security (RLS)

All tables have RLS enabled with the following policies:

**quick_facts:**
- Public read access (for prompt building)
- Service role only for writes

**fact_history:**
- Public read access (for debugging)
- Service role only for writes

**fact_promotion_queue:**
- Service role access only

### Permissions

- **Authenticated users**: Can read facts and statistics
- **Service role**: Can read/write all tables and execute all functions
- **Public**: Can read facts (for prompt building without authentication)

## Fact Key Taxonomy

### Core Identity Facts (Priority 1-2)
- `full_name` - Complete name as stated
- `birth_year` - Year of birth (YYYY format)
- `birthplace` - City/location of birth
- `current_city` - Current residence
- `speaking_style` - Tone and manner of communication
- `humor_style` - Type of humor used
- `emotional_expression` - How emotions are conveyed

### Life Context Facts (Priority 3-5)
- `grew_up` - Where they spent childhood
- `moved_to__<city>__year` - Relocation events
- `education__<institution>` - Educational background
- `career__<role>__<company>` - Professional history
- `languages` - Languages spoken
- `hobbies` - Regular activities/interests

### Relationships (Priority 1-2)
- `family_parents` - Parent names/descriptions
- `partner_name` - Spouse/partner information
- `children` - Child information
- `pets_current` - Current pets (may expire)

### Personal Attributes (Priority 3-5)
- `core_values` - Fundamental beliefs
- `signature_phrases` - Distinctive expressions
- `personality_traits` - Key character attributes

## Migration Files

The schema is implemented across multiple migration files:

1. `005_create_quick_facts_table.sql` - Main facts table
2. `006_create_fact_history_table.sql` - History tracking
3. `007_create_fact_promotion_trigger.sql` - Automatic promotion queue
4. `008_create_quick_facts_functions.sql` - Helper functions

## Testing

Run `test-quick-facts-schema.sql` in Supabase SQL Editor to validate the schema:

```sql
-- Creates test avatar and facts
-- Tests all functions and constraints
-- Validates triggers and history tracking
-- Cleans up test data
```

## Usage Examples

### Basic Fact Management

```sql
-- Insert a new fact
SELECT public.upsert_quick_fact(
    avatar_id, 'birth_year', '1985', 0.9, 2, 'heuristic'
);

-- Get all high-priority facts
SELECT * FROM public.fetch_quick_facts(avatar_id, 3);

-- Get style profile for prompt building
SELECT * FROM public.fetch_style_profile(avatar_id);
```

### Debugging and Monitoring

```sql
-- Get fact statistics
SELECT * FROM public.get_fact_statistics(avatar_id);

-- Check recent changes
SELECT * FROM public.fact_history 
WHERE avatar_id = ? 
ORDER BY changed_at DESC LIMIT 10;

-- Monitor promotion queue
SELECT status, COUNT(*) 
FROM public.fact_promotion_queue 
GROUP BY status;
```

### Cleanup and Maintenance

```sql
-- Clean up old promotion queue entries
SELECT public.cleanup_fact_promotion_queue();

-- Remove expired facts
DELETE FROM public.quick_facts 
WHERE expires_at IS NOT NULL AND expires_at <= NOW();
```

## Performance Considerations

- **Quick fact retrieval**: Optimized for sub-100ms performance with proper indexing
- **Priority-based queries**: Use `fetch_quick_facts()` with max_priority parameter
- **Batch operations**: Use transactions for multiple fact updates
- **Queue processing**: Process promotion queue in background jobs
- **History cleanup**: Regularly clean old history entries to prevent bloat

## Integration Points

- **Avatar creation**: Extract facts from seed text and store in quick_facts
- **Memory addition**: Queue fact promotion when new fragments are added
- **Prompt building**: Always fetch quick_facts first before other context
- **Debug endpoints**: Use helper functions for debugging and monitoring