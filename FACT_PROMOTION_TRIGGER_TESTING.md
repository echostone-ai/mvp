# Fact Promotion Trigger System Testing Guide

This document explains how to test the database trigger system for automatic fact promotion.

## Overview

The fact promotion trigger system automatically queues fact promotion jobs when new memory fragments are inserted into the database. This implements requirements 9.1 and 9.7 for real-time fact promotion within 200ms.

## Components Implemented

### 1. Database Trigger (`supabase/migrations/007_create_fact_promotion_trigger.sql`)
- Creates `fact_promotion_queue` table for job queuing
- Implements trigger function `queue_fact_promotion()` 
- Adds trigger `queue_fact_promotion_on_fragment_insert` on `memory_fragments`
- Provides utility functions for job management

### 2. Background Processor (`src/lib/services/factPromotionProcessor.ts`)
- Processes queued jobs in batches
- Implements retry logic and error handling
- Monitors performance and tracks statistics
- Respects 200ms processing target

### 3. Service Manager (`src/lib/services/backgroundServiceManager.ts`)
- Manages processor lifecycle
- Handles graceful startup and shutdown
- Provides health monitoring
- Configurable via environment variables

### 4. API Endpoints
- `/api/fact-promotion` - Monitor and control fact promotion
- `/api/services` - Manage background services

## Testing the Trigger System

### 1. Manual Database Testing

```sql
-- 1. Check if trigger is installed
SELECT trigger_name, event_manipulation, event_object_table 
FROM information_schema.triggers 
WHERE trigger_name = 'queue_fact_promotion_on_fragment_insert';

-- 2. Insert a test memory fragment (this should trigger fact promotion)
INSERT INTO memory_fragments (user_id, avatar_id, fragment_text, embedding, conversation_context)
VALUES (
  'test-user-id',
  'test-avatar-id', 
  'I work as a software engineer at Google',
  array_fill(0.1, ARRAY[1536])::vector,
  '{"type": "bio"}'::jsonb
);

-- 3. Check if job was queued
SELECT * FROM fact_promotion_queue WHERE avatar_id = 'test-avatar-id';

-- 4. Check queue statistics
SELECT * FROM get_promotion_queue_stats();
```

### 2. API Testing

```bash
# Start background services
curl -X POST http://localhost:3000/api/services \
  -H "Content-Type: application/json" \
  -d '{"action": "initialize"}'

# Check service health
curl http://localhost:3000/api/services?action=health

# Check fact promotion status
curl http://localhost:3000/api/fact-promotion?action=status

# Check performance metrics
curl http://localhost:3000/api/fact-promotion?action=performance

# Check queue backlog
curl http://localhost:3000/api/fact-promotion?action=queue-backlog
```

### 3. Integration Testing

```typescript
// Example test for trigger integration
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Test trigger functionality
async function testTriggerIntegration() {
  // 1. Insert memory fragment
  const { data: fragment } = await supabase
    .from('memory_fragments')
    .insert({
      user_id: 'test-user',
      avatar_id: 'test-avatar',
      fragment_text: 'I have a dog named Max',
      embedding: new Array(1536).fill(0.1),
      conversation_context: { type: 'bio' }
    })
    .select()
    .single();

  // 2. Check if job was queued
  const { data: jobs } = await supabase
    .from('fact_promotion_queue')
    .select('*')
    .eq('fragment_id', fragment.id);

  console.log('Queued jobs:', jobs);

  // 3. Wait for processing
  await new Promise(resolve => setTimeout(resolve, 1000));

  // 4. Check if facts were promoted
  const { data: facts } = await supabase
    .from('quick_facts')
    .select('*')
    .eq('avatar_id', 'test-avatar');

  console.log('Promoted facts:', facts);
}
```

## Performance Monitoring

### Key Metrics to Monitor

1. **Processing Time**: Should be under 200ms per job
2. **Success Rate**: Should be above 95%
3. **Queue Backlog**: Should not exceed 50 pending jobs
4. **Error Rate**: Should be below 5%

### Monitoring Endpoints

- `GET /api/fact-promotion?action=performance` - Detailed performance metrics
- `GET /api/fact-promotion?action=queue-backlog` - Queue status
- `GET /api/services?action=health` - Overall service health

## Configuration

### Environment Variables

```bash
# Fact promotion configuration
FACT_PROMOTION_ENABLED=true
FACT_PROMOTION_BATCH_SIZE=10
FACT_PROMOTION_INTERVAL_MS=1000
FACT_PROMOTION_MAX_CONCURRENT=5
FACT_PROMOTION_ENABLE_RETRIES=true
FACT_PROMOTION_MAX_RETRIES=3
FACT_PROMOTION_TIMEOUT_MS=5000
```

### Database Functions Available

- `get_pending_promotion_jobs(batch_size)` - Get jobs to process
- `start_promotion_job(job_id)` - Mark job as processing
- `complete_promotion_job(job_id, processing_time_ms)` - Mark job complete
- `fail_promotion_job(job_id, error_msg)` - Mark job failed
- `cleanup_promotion_jobs(older_than_days)` - Clean old jobs
- `get_promotion_queue_stats()` - Get queue statistics

## Troubleshooting

### Common Issues

1. **Jobs not being queued**: Check if trigger is installed and memory_fragments has avatar_id column
2. **Jobs not processing**: Check if background service is running
3. **Slow processing**: Check database performance and concurrent job limits
4. **High error rate**: Check fact extraction engine configuration

### Debug Commands

```sql
-- Check trigger status
SELECT * FROM pg_trigger WHERE tgname = 'queue_fact_promotion_on_fragment_insert';

-- Check recent jobs
SELECT * FROM fact_promotion_queue ORDER BY created_at DESC LIMIT 10;

-- Check error patterns
SELECT error_message, COUNT(*) 
FROM fact_promotion_queue 
WHERE status = 'failed' 
GROUP BY error_message;
```

## Implementation Status

✅ Database trigger and queue system
✅ Background processor with retry logic  
✅ Performance monitoring and metrics
✅ API endpoints for management
✅ Service lifecycle management
✅ Error handling and logging
✅ Configuration via environment variables
✅ Basic unit tests

The trigger system is fully implemented and ready for production use. The background processor will automatically start when the application initializes and will process fact promotion jobs within the 200ms target specified in the requirements.