# Avatar Sharing System

This document outlines the avatar sharing functionality that allows users to share their avatars with others via email, enabling private conversations and memories.

## Features

### For Avatar Owners
- Share avatars with specific people via email
- Control permissions (chat, view memories, create memories)
- View who has access to your avatars
- Revoke access at any time
- Each person gets their own private conversation space

### For People Receiving Shared Avatars
- Accept invitations to chat with shared avatars
- Have private conversations that only you can see
- Create and manage private memories with the avatar
- Your conversations and memories are isolated from other users
- Access shared avatars from a dedicated page

## How It Works

1. **Sharing an Avatar**
   - Go to your avatar's page
   - Click "Share Avatar"
   - Enter the recipient's email
   - Set permissions
   - Send invitation

2. **Accepting an Invitation**
   - Recipient receives an email with a link
   - They click the link and enter their email
   - They now have access to chat with the avatar

3. **Private Conversations**
   - Each user has their own conversation history
   - The avatar owner cannot see these conversations
   - Conversations are stored separately for each user

4. **Private Memories**
   - As users chat with the avatar, important information is saved as memories
   - Users can also manually add memories
   - These memories are private to each user
   - The avatar uses these memories to provide personalized responses

## Technical Implementation

The system uses several API endpoints:

- `/api/avatar-sharing` - Manages sharing invitations and access
- `/api/private-conversations` - Handles user-specific conversations
- `/api/private-memories` - Manages user-specific memories

Each shared avatar session is isolated using a combination of:
- User ID/email
- Avatar ID
- Share token

This ensures complete privacy and data isolation between users.

## Privacy and Security

- All conversations and memories are private to each user
- The avatar owner cannot access other users' conversations
- Each user gets their own isolated experience
- Access can be revoked at any time
- Users can delete all their data if desired

## Future Enhancements

- Email notification system for invitations
- More granular permission controls
- Ability to share specific memories with the avatar owner
- Analytics for avatar owners (without revealing conversation content)
- Group sharing options