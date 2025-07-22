/**
 * Email Service for sending avatar sharing invitations
 * 
 * In a production environment, this would use a real email service like SendGrid, Mailgun, etc.
 * For now, we'll simulate email sending with console logs and return mock responses.
 */

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

/**
 * Send an email
 * @param options Email options including recipient, subject, and content
 * @returns Promise that resolves when email is sent
 */
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  console.log('📧 SENDING EMAIL:');
  console.log('To:', options.to);
  console.log('Subject:', options.subject);
  console.log('Content:', options.html);
  
  // In a real implementation, this would call an email service API
  // For now, we'll simulate a successful send
  
  return {
    success: true,
    messageId: `mock-email-${Date.now()}`
  };
}

/**
 * Send an avatar sharing invitation email
 * @param recipientEmail Email address of the recipient
 * @param senderName Name of the person sharing the avatar
 * @param avatarName Name of the avatar being shared
 * @param shareToken Unique token for accessing the shared avatar
 * @returns Promise that resolves when email is sent
 */
export async function sendAvatarInvitation(
  recipientEmail: string,
  senderName: string,
  avatarName: string,
  shareToken: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const inviteUrl = `${baseUrl}/shared-avatar/${shareToken}`;
  
  const emailOptions: EmailOptions = {
    to: recipientEmail,
    subject: `${senderName} has shared their avatar with you!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #9b7cff 0%, #7c5dff 100%); padding: 20px; text-align: center; color: white; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0;">Avatar Invitation</h1>
        </div>
        <div style="background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #333;">
            <strong>${senderName}</strong> has shared their avatar <strong>${avatarName}</strong> with you!
          </p>
          <p style="font-size: 16px; color: #333;">
            You can now chat with ${avatarName} and have your own private conversations.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteUrl}" style="background: linear-gradient(135deg, #9b7cff 0%, #7c5dff 100%); color: white; text-decoration: none; padding: 12px 24px; border-radius: 5px; font-weight: bold;">
              Chat with ${avatarName}
            </a>
          </div>
          <p style="font-size: 14px; color: #666; margin-top: 30px;">
            This invitation link will expire in 30 days.
          </p>
        </div>
      </div>
    `,
    from: 'invitations@echostone.ai'
  };
  
  return sendEmail(emailOptions);
}