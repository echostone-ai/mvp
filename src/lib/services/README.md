# User Story Service

This directory contains the core service implementation for the Authentic Voice Stories feature.

## Overview

The `UserStoryService` provides CRUD operations for managing user-uploaded story recordings that can be triggered during avatar conversations. This is part of Task 1 from the authentic voice stories specification.

## Components

### Database Schema
- **Migration**: `supabase/migrations/025_create_user_stories_tables.sql`
- **Tables**: `user_stories`, `story_usage_analytics`
- **Constraints**: 5-story limit per avatar, duration limits (30s-5min), file size limits (10MB)

### TypeScript Types
- **Location**: `src/lib/types/stories.ts`
- **Interfaces**: `UserStory`, `StoryUploadRequest`, `StoryListResponse`, etc.
- **Validation**: File validation, metadata validation, constraint enforcement

### Service Implementation
- **Location**: `src/lib/services/userStoryService.ts`
- **Features**: 
  - CRUD operations with validation
  - API-level story limit enforcement (defense in depth)
  - Trigger keyword matching
  - Usage analytics recording

## Key Features Implemented

### ✅ Database Schema
- Created `user_stories` table with proper constraints
- Added `story_usage_analytics` table for tracking
- Implemented database-level 5-story limit constraint
- Added proper indexes for performance

### ✅ TypeScript Interfaces
- Complete type definitions matching database schema
- Validation schemas with proper error handling
- Helper functions for trigger string formatting

### ✅ API-Level Enforcement
- Story limit checking before database operations
- File validation (MP3, 10MB limit)
- Metadata validation (title, category, triggers)
- Graceful error handling with custom error types

### ✅ Core Service Methods
- `createStory()` - Upload and create new stories
- `getStories()` - List stories with filtering/pagination
- `updateStory()` - Update story metadata
- `deleteStory()` - Remove stories
- `findMatchingStories()` - Simple keyword matching for triggers
- `recordUsage()` - Track story usage analytics

## Testing

### Unit Tests
- **Location**: `src/lib/services/__tests__/userStoryService.test.ts`
- **Coverage**: Validation, CRUD operations, limit enforcement, trigger matching

### Integration Tests
- **Location**: `src/lib/services/__tests__/userStoryService.integration.test.ts`
- **Coverage**: Schema validation, constraint simulation, file validation

## Usage Example

```typescript
import { UserStoryService } from './userStoryService';

const service = new UserStoryService();

// Create a new story
const result = await service.createStory({
  file: audioFile,
  title: 'My Childhood Memory',
  category: 'memory',
  triggers: ['childhood', 'school', 'friends'],
  transcript: 'Optional transcript text...'
});

// Find matching stories for conversation
const matches = await service.findMatchingStories(
  'Tell me about your childhood',
  'avatar-id',
  'avatar'
);
```

## Next Steps

This implementation completes Task 1 of the authentic voice stories specification. The next tasks will build upon this foundation to add:

1. File storage and management (Task 2)
2. Story management UI (Task 5)
3. Trigger matching integration (Task 6)
4. Audio playback system (Task 7)

## Requirements Satisfied

- ✅ **Requirement 5.1**: Database schema with appropriate indexing
- ✅ **Requirement 5.6**: 5-story limit per avatar enforcement
- ✅ All sub-tasks from Task 1:
  - Database migration with simplified trigger storage
  - TypeScript interfaces and validation schemas
  - Database constraints for story limits
  - API-level limit enforcement
  - Analytics table for tracking