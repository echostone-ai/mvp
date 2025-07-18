# Avatar Memory System

This document explains how to use the avatar-specific memory system in EchoStone.

## Overview

The avatar memory system allows each avatar to have its own isolated set of memories, while still being associated with a specific user. This means:

1. Users can have multiple avatars
2. Each avatar has its own memory context
3. Memories are isolated between avatars
4. The same user can interact with different avatars and each will have its own memory context

## Implementation

### Database Changes

The implementation includes:

1. A new `avatar_profiles` table to store avatar information
2. An `avatar_id` column in the `memory_fragments` table to associate memories with specific avatars
3. Updated database indexes for efficient queries
4. An updated vector search function that supports filtering by avatar ID

### Code Changes

The following components have been updated:

1. **Memory Service**: Updated to support avatar-specific memories
2. **Chat API**: Modified to accept and use avatar IDs for memory operations
3. **Chat Interface**: Updated to pass avatar IDs to the API
4. **Avatar Pages**: New pages for managing avatars and chatting with specific avatars

## How to Use

### Creating Avatars

1. Navigate to `/avatars` to see your avatars
2. Use the form to create a new avatar with a name and description
3. Click on an avatar to chat with it

### Chatting with Avatars

When chatting with an avatar at `/avatars/[avatarId]`:

1. The system automatically isolates memories to that specific avatar
2. The avatar will only recall conversations and information shared with it specifically
3. Other avatars won't have access to these memories

## Technical Notes

### Memory Isolation

Memory isolation is achieved by:

1. Including `avatarId` in memory fragment queries
2. Storing `avatarId` with each memory fragment
3. Using the updated `match_memory_fragments` function that filters by both user and avatar

### Security Considerations

For the prototype, we've kept security loose by:

1. Not implementing row-level security policies for avatars yet
2. Not restricting avatar access by user ID

In a production environment, you would want to:

1. Add RLS policies to restrict avatar access to their owners
2. Implement proper authentication checks in the avatar pages
3. Add validation to ensure users can only access their own avatars' memories

## Next Steps

Future enhancements could include:

1. Avatar customization (appearance, voice settings)
2. Sharing avatars between users
3. Avatar-specific personality traits
4. Memory management per avatar
5. Avatar analytics