import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { sendAvatarInvitation } from '@/lib/emailService';
import { createApiHandler } from '@/lib/api/routeHandler';

// Define schema for validation
const emailSchema = z.object({
  recipientEmail: z.string().email(),
  avatarName: z.string(),
  ownerEmail: z.string().email(),
  shareUrl: z.string().url(),
  personalMessage: z.string().optional()
});

// Handler function for sending invitation emails
async function handleSendInvitation(data: z.infer<typeof emailSchema>, request: NextRequest): Promise<NextResponse> {
  const { recipientEmail, avatarName, ownerEmail, shareUrl, personalMessage } = data;
  
  // Extract share token from URL
  const shareToken = shareUrl.split('/').pop() || '';
  
  try {
    const result = await sendAvatarInvitation(
      recipientEmail,
      ownerEmail,
      avatarName,
      shareToken,
      personalMessage
    );
    
    return NextResponse.json({ 
      success: result.success, 
      message: result.message || 'Invitation email sent successfully',
      // For development, return the email content so you can see what would be sent
      emailContent: process.env.NODE_ENV === 'development' ? {
        to: recipientEmail,
        from: 'noreply@echostone.ai',
        subject: `You've been invited to chat with ${avatarName}`,
        shareUrl
      } : undefined
    });
  } catch (error) {
    console.error('Error sending invitation email:', error);
    return NextResponse.json({ 
      error: 'Failed to send invitation email' 
    }, { status: 500 });
  }
}

// Create API handler with validation
const sendInvitationHandler = createApiHandler(emailSchema, handleSendInvitation);

export async function POST(request: NextRequest) {
  return sendInvitationHandler(request);
}