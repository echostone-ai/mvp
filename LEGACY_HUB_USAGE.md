# Legacy Hub Feature

The Legacy Hub feature allows users to create and share memory collections with friends and family. This document explains how to use the feature and provides technical details for developers.

## User Guide

### Accessing Legacy Hubs

1. Log in to your account
2. Navigate to the `/hubs` page
3. You'll see your hubs and hubs shared with you

### Creating a New Hub

1. On the Legacy Hubs page, click the "Create New Hub" button
2. Fill in the hub name and optional description
3. Choose whether to publish the hub immediately or keep it as a draft
4. Click "Create Hub" to create your new Legacy Hub

### Managing Your Hub

#### Adding Memories

1. Open your hub by clicking on it from the Legacy Hubs page
2. Click the "Add Memory" button
3. Choose the memory type (text, image, or audio)
4. Enter your memory content or upload your file
5. Click "Add Memory" to save it to the hub

#### Inviting Others

1. Open your hub and go to the "Settings" tab
2. Click on the "Invitations" tab
3. Enter an email address (optional) and set an expiration period
4. Click "Create Invitation" to generate a new invitation link
5. Share the invitation link with others

#### Managing Viewers

1. Open your hub and go to the "Settings" tab
2. Click on the "Viewers" tab
3. View all users who have access to your hub
4. Remove viewers if needed by clicking the "Remove" button

#### Moderating Content

1. Open your hub and click on the "Flagged Content" tab
2. Review any content that has been flagged by viewers
3. Choose to keep or remove the flagged content
4. The system will notify the person who flagged the content of your decision

### Viewing Shared Hubs

1. On the Legacy Hubs page, scroll down to the "Shared With You" section
2. Click on any hub to view its contents
3. You can add your own memories to shared hubs
4. If you find inappropriate content, you can flag it for the owner to review

### Accepting Invitations

1. When someone shares a hub with you, you'll receive an invitation link
2. Click the link to open the invitation page
3. If you're not logged in, you'll need to sign in or create an account
4. Click "Accept Invitation" to gain access to the hub
5. You'll be redirected to the hub where you can view and contribute memories

## Developer Guide

### API Endpoints

#### Hub Management

- `GET /api/hubs` - Get all hubs for the current user
- `POST /api/hubs` - Create a new hub
- `GET /api/hubs/:hubId` - Get hub details
- `PUT /api/hubs/:hubId` - Update hub details
- `DELETE /api/hubs/:hubId` - Delete a hub

#### Memory Management

- `GET /api/hubs/:hubId/memories` - Get memories for a hub
- `POST /api/hubs/:hubId/memories` - Create a new memory
- `GET /api/hubs/:hubId/memories/:memoryId` - Get a specific memory
- `DELETE /api/hubs/:hubId/memories/:memoryId` - Delete a memory

#### Flag Management

- `POST /api/hubs/:hubId/memories/:memoryId/flag` - Flag a memory
- `GET /api/hubs/:hubId/flags` - Get flags for a hub
- `POST /api/hubs/:hubId/flags/:flagId/resolve` - Resolve a flag

#### Invitation Management

- `GET /api/hubs/:hubId/invitations` - Get invitations for a hub
- `POST /api/hubs/:hubId/invitations` - Create a new invitation
- `GET /api/invitations/:token/validate` - Validate an invitation token
- `POST /api/invitations/:token/accept` - Accept an invitation

#### Viewer Management

- `GET /api/hubs/:hubId/viewers` - Get viewers for a hub
- `DELETE /api/hubs/:hubId/viewers/:viewerId` - Remove a viewer's access

#### File Upload

- `POST /api/upload` - Upload a file (image or audio)

### Database Schema

The Legacy Hub feature uses the following database tables:

1. **Hub** - Stores hub information
   - id, name, description, ownerId, isPublished, createdAt, updatedAt

2. **Memory** - Stores memory content
   - id, hubId, content, contentType, authorId, isOwnerMemory, createdAt

3. **Flag** - Stores flagged content
   - id, hubId, memoryId, reporterId, reason, status, createdAt, resolvedAt

4. **Invitation** - Stores invitation links
   - id, hubId, email, token, expiresAt, isUsed, createdAt

5. **ViewerAccess** - Stores viewer access information
   - id, hubId, userId, accessLevel, createdAt, lastAccessAt

6. **Notification** - Stores notifications
   - id, userId, type, content, isRead, relatedId, createdAt

These tables are defined in the Prisma schema at `prisma/schema.prisma`.

### Implementation Details

1. **Authentication** - All API endpoints require authentication using NextAuth.js
2. **Authorization** - Hub access is controlled by the `checkHubAccess` helper function
3. **Rate Limiting** - File uploads and memory creation are rate-limited
4. **Notifications** - The system sends notifications for new memories, flags, and invitation acceptances

### Deployment Requirements

1. **Database** - PostgreSQL database with Prisma ORM
2. **Storage** - Local file storage for uploaded media (in production, use a cloud storage service)
3. **Environment Variables** - Set up the following environment variables:
   - `DATABASE_URL` - PostgreSQL connection string
   - `NEXTAUTH_SECRET` - Secret for NextAuth.js
   - `NEXT_PUBLIC_BASE_URL` - Base URL for the application