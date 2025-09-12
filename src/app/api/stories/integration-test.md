# Stories API Integration Test

This document outlines the integration test steps for the Stories API endpoints.

## Prerequisites

1. Set `STORIES_ENABLED=true` in your `.env` file
2. Ensure the database migration has been run:
   ```bash
   # Check if the user_stories table exists
   psql -d your_database -c "\d user_stories"
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## Test Steps

### 1. Test Feature Flag Gating

**Without feature flag:**
```bash
# Should return 404 (Feature not available)
curl "http://localhost:3000/api/stories?avatarId=test-avatar"
```

**With feature flag enabled:**
```bash
# Should return 200 with empty stories array
curl "http://localhost:3000/api/stories?avatarId=test-avatar"
```

### 2. Test GET Endpoint Validation

**Missing avatarId:**
```bash
# Should return 400 (avatarId is required)
curl "http://localhost:3000/api/stories"
```

**Valid request:**
```bash
# Should return 200 with stories array
curl "http://localhost:3000/api/stories?avatarId=test-avatar&ownerType=avatar"
```

### 3. Test Rate Limiting

**Check rate limit headers:**
```bash
curl -I "http://localhost:3000/api/stories?avatarId=test-avatar"
# Should include:
# X-RateLimit-Limit: 100
# X-RateLimit-Remaining: 99
# X-RateLimit-Reset: [timestamp]
```

### 4. Test POST Endpoint Authentication

**Without authentication:**
```bash
# Should return 401 (Authentication required)
curl -X POST "http://localhost:3000/api/stories" \
  -F "title=Test Story" \
  -F "category=memory" \
  -F "triggers=test,story"
```

**With invalid token:**
```bash
# Should return 401 (Authentication required)
curl -X POST "http://localhost:3000/api/stories" \
  -H "Authorization: Bearer invalid-token" \
  -F "title=Test Story" \
  -F "category=memory" \
  -F "triggers=test,story"
```

### 5. Test POST Endpoint Validation

**Missing required fields:**
```bash
# Should return 400 (Audio file is required)
curl -X POST "http://localhost:3000/api/stories" \
  -H "Authorization: Bearer valid-token"
```

**Invalid category:**
```bash
# Should return 400 (Invalid category)
curl -X POST "http://localhost:3000/api/stories" \
  -H "Authorization: Bearer valid-token" \
  -F "file=@test-audio.mp3" \
  -F "title=Test Story" \
  -F "category=invalid" \
  -F "triggers=test,story"
```

**Too many triggers:**
```bash
# Should return 400 (Maximum 20 trigger keywords)
curl -X POST "http://localhost:3000/api/stories" \
  -H "Authorization: Bearer valid-token" \
  -F "file=@test-audio.mp3" \
  -F "title=Test Story" \
  -F "category=memory" \
  -F "triggers=1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21"
```

## Expected Behavior

### GET /api/stories
- ✅ Returns 404 when feature flag disabled
- ✅ Returns 400 when avatarId missing
- ✅ Returns 200 with stories array when valid
- ✅ Includes rate limit headers
- ✅ Supports both 'user' and 'avatar' ownerType

### POST /api/stories
- ✅ Returns 404 when feature flag disabled
- ✅ Returns 401 when not authenticated
- ✅ Returns 400 for missing required fields
- ✅ Returns 400 for invalid category
- ✅ Returns 400 for too many triggers
- ✅ Returns 403 when avatar story limit reached (5 stories)
- ✅ Includes upload rate limiting (10 per hour)

## Manual Testing Script

Run the automated test script:
```bash
node test-stories-api.js
```

This will test the basic functionality and provide a report of the API status.

## Database Verification

After successful story uploads, verify in the database:
```sql
-- Check stories table
SELECT id, title, category, triggers, status, created_at 
FROM user_stories 
ORDER BY created_at DESC 
LIMIT 10;

-- Check story count per avatar
SELECT owner_id, owner_type, COUNT(*) as story_count
FROM user_stories 
GROUP BY owner_id, owner_type;
```

## Troubleshooting

**Feature flag not working:**
- Check `.env` file has `STORIES_ENABLED=true`
- Restart development server after changing environment variables

**Database errors:**
- Ensure migration `025_create_user_stories_tables.sql` has been applied
- Check database connection and permissions

**Authentication errors:**
- Verify Supabase configuration
- Check that auth tokens are valid and not expired

**File upload errors:**
- Ensure file is valid MP3 format
- Check file size is under 10MB
- Verify audio duration is between 30s and 5 minutes