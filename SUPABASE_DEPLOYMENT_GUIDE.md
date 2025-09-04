# Supabase Deployment Guide - Authentic Expressions Pipeline

## Overview

This guide covers the database setup and configuration needed to deploy the Authentic Expressions Pipeline to production. The feature requires two main database migrations and some environment configuration.

## Prerequisites

- Supabase project set up and accessible
- Supabase CLI installed (`npm install -g supabase`)
- Database connection credentials
- Admin access to your Supabase project

## Required Migrations

### 1. Expression Clips Table (Migration 017)
**File:** `supabase/migrations/017_create_expression_clips.sql`

**What it creates:**
- `expression_clips` table for storing user and avatar expression audio files
- Enum types: `expression_type` and `expression_status`
- Performance indexes for efficient querying
- Row Level Security (RLS) policies for data isolation
- Automatic timestamp triggers

**Key features:**
- Supports both user and avatar expressions
- Priority system for admin expressions
- Duration limits (max 300ms for expressions)
- CDN URL storage for optimized delivery

### 2. Expression Privacy Settings (Migration 018)
**File:** `supabase/migrations/018_add_expression_privacy_settings.sql`

**What it creates:**
- `profiles` table (if not exists) for user settings
- Privacy settings support in JSONB format
- Automatic profile creation for new users
- RLS policies for user data isolation

## Deployment Steps

### Step 1: Connect to Your Supabase Project

```bash
# Login to Supabase (if not already logged in)
supabase login

# Link to your project (replace with your project reference)
supabase link --project-ref YOUR_PROJECT_REF
```

### Step 2: Run Database Migrations

```bash
# Apply the expression clips migration
supabase db push

# Or apply specific migrations if needed
supabase migration up --include-all
```

### Step 3: Verify Migration Success

Connect to your Supabase dashboard and verify:

1. **Tables Created:**
   - `public.expression_clips` 
   - `public.profiles` (if it didn't exist)

2. **Enum Types Created:**
   - `expression_type` (laugh, sigh, breath, etc.)
   - `expression_status` (active, inactive, processing, failed)

3. **Indexes Created:**
   - `expression_clips_owner_idx`
   - `expression_clips_type_idx` 
   - `expression_clips_priority_idx`
   - `expression_clips_created_at_idx`

4. **RLS Policies Active:**
   - Users can only access their own expressions
   - Service role can manage avatar expressions
   - Public read access for active expressions

### Step 4: Configure Environment Variables

Add these environment variables to your deployment:

```bash
# Feature flag for expressions (start with false for safe deployment)
NEXT_PUBLIC_FEATURE_VOICE_OVERLAYS=false
FEATURE_VOICE_OVERLAYS=false

# Supabase configuration (if not already set)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# CDN configuration for expression files
NEXT_PUBLIC_CDN_BASE_URL=your_cdn_url
```

### Step 5: Test Database Setup

Run this SQL query in your Supabase SQL editor to verify setup:

```sql
-- Test expression_clips table
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'expression_clips' 
ORDER BY ordinal_position;

-- Test enum types
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = 'expression_type'::regtype;

-- Test RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'expression_clips';

-- Test profiles table
SELECT COUNT(*) as profile_count FROM public.profiles;
```

Expected results:
- `expression_clips` table with 12 columns
- 7 expression types in enum
- 3 RLS policies configured
- Profiles table exists with user data

## Storage Configuration

### CDN Setup for Expression Files

You'll need to configure file storage for expression audio files:

#### Option 1: Supabase Storage (Recommended)

```sql
-- Create storage bucket for expressions
INSERT INTO storage.buckets (id, name, public) 
VALUES ('expressions', 'expressions', true);

-- Create RLS policy for expression uploads
CREATE POLICY "Users can upload their own expressions" ON storage.objects
FOR INSERT WITH CHECK (
    bucket_id = 'expressions' AND 
    auth.uid()::text = (storage.foldername(name))[1]
);

-- Create RLS policy for public read access
CREATE POLICY "Public read access for expressions" ON storage.objects
FOR SELECT USING (bucket_id = 'expressions');
```

#### Option 2: External CDN

If using an external CDN (AWS S3, Cloudflare, etc.):
- Configure your CDN service
- Update `NEXT_PUBLIC_CDN_BASE_URL` environment variable
- Ensure CORS is configured for your domain

## Security Considerations

### Row Level Security (RLS)

The migrations automatically configure RLS policies:

1. **User Expressions:** Users can only access their own expressions
2. **Avatar Expressions:** Service role can manage avatar expressions  
3. **Public Access:** Active expressions are publicly readable
4. **Privacy Settings:** Users control their expression privacy via profiles

### Data Validation

Database constraints ensure:
- Expression duration ≤ 300ms (5 minutes max for processing)
- Priority levels 0-100
- Valid expression types and statuses
- Required fields are not null

## Monitoring and Maintenance

### Performance Monitoring

Monitor these queries for performance:

```sql
-- Most used expressions
SELECT type, COUNT(*) as usage_count 
FROM expression_clips 
WHERE status = 'active' 
GROUP BY type 
ORDER BY usage_count DESC;

-- Expression upload trends
SELECT DATE(created_at) as date, COUNT(*) as uploads
FROM expression_clips 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date;

-- Storage usage by owner
SELECT owner_type, COUNT(*) as clip_count, 
       AVG(duration_ms) as avg_duration
FROM expression_clips 
WHERE status = 'active'
GROUP BY owner_type;
```

### Cleanup Tasks

Set up periodic cleanup for:

```sql
-- Remove failed processing attempts older than 24 hours
DELETE FROM expression_clips 
WHERE status = 'failed' 
AND created_at < NOW() - INTERVAL '24 hours';

-- Archive inactive expressions older than 90 days
UPDATE expression_clips 
SET status = 'inactive' 
WHERE status = 'active' 
AND updated_at < NOW() - INTERVAL '90 days'
AND owner_type = 'user';
```

## Rollback Plan

If you need to rollback the migrations:

```sql
-- Rollback migration 018 (privacy settings)
-- Note: This will not drop the profiles table if it existed before
-- Only removes the expression-specific additions

-- Rollback migration 017 (expression clips)
DROP TABLE IF EXISTS public.expression_clips CASCADE;
DROP TYPE IF EXISTS expression_type CASCADE;
DROP TYPE IF EXISTS expression_status CASCADE;
DROP FUNCTION IF EXISTS update_expression_clips_updated_at() CASCADE;
```

## Gradual Rollout Strategy

### Phase 1: Infrastructure Only
```bash
# Deploy with feature disabled
FEATURE_VOICE_OVERLAYS=false
```
- Database migrations applied
- No user-facing changes
- Validate infrastructure

### Phase 2: Internal Testing
```bash
# Enable for admin/internal users only
FEATURE_VOICE_OVERLAYS=true
# Configure user-specific feature flags if available
```

### Phase 3: Beta Users
- Enable for selected beta users
- Monitor performance and usage
- Collect feedback

### Phase 4: Full Rollout
- Enable globally
- Monitor metrics and performance
- Scale infrastructure as needed

## Troubleshooting

### Common Issues

1. **Migration Fails:**
   - Check database permissions
   - Verify Supabase CLI connection
   - Review migration logs

2. **RLS Policy Issues:**
   - Verify user authentication
   - Check policy conditions
   - Test with service role

3. **Storage Issues:**
   - Verify bucket configuration
   - Check CORS settings
   - Validate CDN URLs

### Support Queries

```sql
-- Check migration status
SELECT * FROM supabase_migrations.schema_migrations 
WHERE version IN ('017', '018');

-- Verify table structure
\d+ expression_clips
\d+ profiles

-- Test RLS policies
SET ROLE authenticated;
SELECT * FROM expression_clips LIMIT 1;
```

## Success Criteria

✅ **Database Setup Complete When:**
- All migrations applied successfully
- Tables and indexes created
- RLS policies active and tested
- Storage bucket configured
- Environment variables set
- Test queries return expected results

✅ **Ready for Feature Rollout When:**
- Infrastructure validated
- Performance baselines established
- Monitoring configured
- Rollback procedures tested

---

**Next Steps:** Once database setup is complete, follow the deployment checklist in `EXPRESSIONS_DEPLOYMENT_CHECKLIST.md` for the full feature rollout.