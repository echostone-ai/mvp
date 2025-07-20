# Design Document for Legacy Hub

## Overview

The Legacy Hub feature enables users to create digital memory repositories that can be shared with and contributed to by friends and family. This design document outlines the architecture, data models, API endpoints, and frontend components needed to implement this feature within the EchoStone platform.

## Architecture

The Legacy Hub feature will follow a standard client-server architecture with the following components:

1. **Database Layer**: Prisma ORM with PostgreSQL for data storage
2. **API Layer**: Next.js API routes using the App Router
3. **Authentication Layer**: Supabase Auth for user authentication and authorization
4. **Frontend Layer**: React components with Next.js for server-side rendering
5. **Storage Layer**: Supabase Storage for media files (images, audio)
6. **Notification Layer**: Email notifications via SendGrid and in-app notifications

## Components and Interfaces

### Database Schema

```prisma
// Schema for Legacy Hub feature

model Hub {
  id            String    @id @default(uuid())
  name          String
  description   String?
  ownerId       String    // References auth.users
  isPublished   Boolean   @default(false)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  // Relations
  memories      Memory[]
  invitations   Invitation[]
  flags         Flag[]
  viewers       ViewerAccess[]

  @@index([ownerId])
}

model Memory {
  id            String    @id @default(uuid())
  hubId         String
  content       String    // Text content or file path
  contentType   String    // "text", "image", "audio"
  authorId      String    // References auth.users
  isOwnerMemory Boolean   @default(false)
  createdAt     DateTime  @default(now())
  
  // Relations
  hub           Hub       @relation(fields: [hubId], references: [id], onDelete: Cascade)
  flags         Flag[]

  @@index([hubId])
  @@index([authorId])
}

model Flag {
  id            String    @id @default(uuid())
  hubId         String
  memoryId      String
  reporterId    String    // References auth.users
  reason        String
  status        String    // "pending", "approved", "rejected"
  createdAt     DateTime  @default(now())
  resolvedAt    DateTime?
  
  // Relations
  hub           Hub       @relation(fields: [hubId], references: [id], onDelete: Cascade)
  memory        Memory    @relation(fields: [memoryId], references: [id], onDelete: Cascade)

  @@index([hubId])
  @@index([memoryId])
  @@index([reporterId])
}

model Invitation {
  id            String    @id @default(uuid())
  hubId         String
  email         String?
  token         String    @unique
  expiresAt     DateTime
  isUsed        Boolean   @default(false)
  createdAt     DateTime  @default(now())
  
  // Relations
  hub           Hub       @relation(fields: [hubId], references: [id], onDelete: Cascade)

  @@index([hubId])
  @@index([token])
}

model ViewerAccess {
  id            String    @id @default(uuid())
  hubId         String
  userId        String    // References auth.users
  accessLevel   String    @default("viewer") // "viewer", "contributor", "moderator"
  createdAt     DateTime  @default(now())
  lastAccessAt  DateTime?
  
  // Relations
  hub           Hub       @relation(fields: [hubId], references: [id], onDelete: Cascade)

  @@unique([hubId, userId])
  @@index([hubId])
  @@index([userId])
}

model Notification {
  id            String    @id @default(uuid())
  userId        String    // References auth.users
  type          String    // "flag", "new_memory", "invitation"
  content       String
  isRead        Boolean   @default(false)
  relatedId     String?   // ID of related entity (flag, memory, etc.)
  createdAt     DateTime  @default(now())

  @@index([userId])
  @@index([isRead])
}
```

### API Endpoints

#### Hub Management

1. **Create/Publish Hub**
   - `POST /api/hubs`
   - Owner only
   - Creates a new Legacy Hub or updates publishing status

2. **Get Hub Details**
   - `GET /api/hubs/:hubId`
   - Accessible to Owner and authorized Viewers
   - Returns hub profile and memories

3. **Update Hub**
   - `PUT /api/hubs/:hubId`
   - Owner only
   - Updates hub details (name, description, settings)

4. **Delete Hub**
   - `DELETE /api/hubs/:hubId`
   - Owner only
   - Removes the hub and all associated data

#### Memory Management

1. **Add Memory**
   - `POST /api/hubs/:hubId/memories`
   - Accessible to Owner and authorized Viewers
   - Creates a new memory entry

2. **Get Memories**
   - `GET /api/hubs/:hubId/memories`
   - Accessible to Owner and authorized Viewers
   - Returns paginated list of memories with optional filtering

3. **Get Single Memory**
   - `GET /api/hubs/:hubId/memories/:memoryId`
   - Accessible to Owner and authorized Viewers
   - Returns details of a specific memory

4. **Delete Memory**
   - `DELETE /api/hubs/:hubId/memories/:memoryId`
   - Owner only
   - Removes a memory entry

#### Flag Management

1. **Flag Memory**
   - `POST /api/hubs/:hubId/memories/:memoryId/flag`
   - Accessible to authorized Viewers
   - Creates a flag for inappropriate content

2. **Get Flags**
   - `GET /api/hubs/:hubId/flags`
   - Owner only
   - Returns list of flagged content

3. **Resolve Flag**
   - `POST /api/hubs/:hubId/flags/:flagId/resolve`
   - Owner only
   - Approves or rejects a flag

#### Invitation Management

1. **Create Invitation**
   - `POST /api/hubs/:hubId/invitations`
   - Owner only
   - Generates invitation links for new viewers

2. **Validate Invitation**
   - `GET /api/invitations/:token/validate`
   - Public endpoint
   - Checks if an invitation is valid

3. **Accept Invitation**
   - `POST /api/invitations/:token/accept`
   - Public endpoint with authentication
   - Accepts an invitation and grants access

4. **Revoke Access**
   - `DELETE /api/hubs/:hubId/viewers/:viewerId`
   - Owner only
   - Removes a viewer's access to the hub

### Frontend Components

#### Owner Dashboard

1. **HubCreationForm**
   - Form for creating and configuring a new Legacy Hub
   - Fields for name, description, visibility settings

2. **FlagsDashboard**
   - List of flagged memories with quick actions
   - Options to approve or remove flagged content

3. **ViewerManagement**
   - Interface for managing viewer access
   - Generate invitation links, revoke access

#### Viewer Experience

1. **HubSplashPage**
   - Landing page for a Legacy Hub
   - Overview of the hub and its owner

2. **MemoryWall**
   - Display of all memories with filtering options
   - Chronological or categorized view

3. **AddMemoryForm**
   - Form for adding new memories
   - Support for text, image, and audio uploads

4. **FlagMemoryModal**
   - Modal for flagging inappropriate content
   - Requires reason for flagging

#### Shared Components

1. **MemoryCard**
   - Display component for individual memories
   - Shows content, author, timestamp

2. **MediaViewer**
   - Component for viewing images and playing audio
   - Supports different media types

3. **NotificationCenter**
   - Displays in-app notifications
   - Alerts for new flags, memories, etc.

## Data Models

### Hub
- Core entity representing a Legacy Hub
- Contains basic information and references to related entities

### Memory
- Represents a single memory entry
- Can be text, image, or audio
- Associated with a specific hub and author

### Flag
- Represents a report of inappropriate content
- Links a memory to a reporter and includes reason
- Has a status that can be updated by the owner

### Invitation
- Represents an invitation to access a hub
- Contains a unique token and expiration date
- Can be used once to grant access

### ViewerAccess
- Represents a viewer's access to a hub
- Includes access level and tracking information

### Notification
- Represents an in-app notification
- Can be related to flags, new memories, etc.

## Error Handling

1. **Authentication Errors**
   - 401 Unauthorized: User not authenticated
   - 403 Forbidden: User doesn't have required permissions

2. **Resource Errors**
   - 404 Not Found: Hub, memory, or flag doesn't exist
   - 410 Gone: Invitation expired or already used

3. **Validation Errors**
   - 400 Bad Request: Invalid input data
   - 422 Unprocessable Entity: Valid data but cannot be processed

4. **Rate Limiting**
   - 429 Too Many Requests: User has exceeded rate limits

## Testing Strategy

1. **Unit Tests**
   - Test individual API endpoints
   - Test component rendering and interactions

2. **Integration Tests**
   - Test complete flows (invitation, adding memory, flagging)
   - Test database interactions

3. **Security Tests**
   - Test permission boundaries
   - Test invitation validation

4. **Performance Tests**
   - Test memory loading with pagination
   - Test media upload and retrieval