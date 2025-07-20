# Legacy Hub Feature

The Legacy Hub feature allows users to create and share memory collections with friends and family. This document explains how to use the feature.

## Accessing Legacy Hubs

1. Log in to your account
2. Click on your profile picture in the top-right corner
3. Select "Legacy Hubs" from the dropdown menu
4. You'll be taken to the Legacy Hubs page where you can see your hubs and hubs shared with you

## Creating a New Hub

1. On the Legacy Hubs page, click the "Create New Hub" button
2. Fill in the hub name and optional description
3. Choose whether to publish the hub immediately or keep it as a draft
4. Click "Create Hub" to create your new Legacy Hub

## Managing Your Hub

### Adding Memories

1. Open your hub by clicking on it from the Legacy Hubs page
2. Click the "Add Memory" button
3. Choose the memory type (text, image, or audio)
4. Enter your memory content or upload your file
5. Click "Add Memory" to save it to the hub

### Inviting Others

1. Open your hub and go to the "Settings" tab
2. Click on the "Invitations" tab
3. Enter an email address (optional) and set an expiration period
4. Click "Create Invitation" to generate a new invitation link
5. Share the invitation link with others or let the system send an email if you provided an address

### Managing Viewers

1. Open your hub and go to the "Settings" tab
2. Click on the "Viewers" tab
3. View all users who have access to your hub
4. Remove viewers if needed by clicking the "Remove" button

### Moderating Content

1. Open your hub and click on the "Flagged Content" tab
2. Review any content that has been flagged by viewers
3. Choose to keep or remove the flagged content
4. The system will notify the person who flagged the content of your decision

## Viewing Shared Hubs

1. On the Legacy Hubs page, scroll down to the "Shared With You" section
2. Click on any hub to view its contents
3. You can add your own memories to shared hubs
4. If you find inappropriate content, you can flag it for the owner to review

## Accepting Invitations

1. When someone shares a hub with you, you'll receive an invitation link
2. Click the link to open the invitation page
3. If you're not logged in, you'll need to sign in or create an account
4. Click "Accept Invitation" to gain access to the hub
5. You'll be redirected to the hub where you can view and contribute memories

## Database Schema Updates

To enable the Legacy Hub feature, the following database schema updates are required:

1. Run the SQL scripts in the Supabase SQL Editor:
   - `supabase/migrations/002_add_avatar_id_to_memory_fragments.sql`
   - `supabase/migrations/003_add_avatar_id_to_conversations.sql`

2. For the full Legacy Hub feature, you'll need to create the following tables:
   - Hub
   - Memory
   - Flag
   - Invitation
   - ViewerAccess
   - Notification

These tables are defined in the Prisma schema at `prisma/schema.prisma`.