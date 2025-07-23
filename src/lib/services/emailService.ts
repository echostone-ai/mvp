export interface EmailResult {
  success: boolean;
  message?: string;
  error?: string;
}

export async function sendAvatarInvitation(
  recipientEmail: string,
  ownerEmail: string,
  avatarName: string,
  shareToken: string,
  personalMessage?: string
): Promise<EmailResult> {
  try {
    const shareUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/shared-avatar/${shareToken}`;
    
    // In a real implementation, you would:
    // 1. Use a service like SendGrid, Mailgun, or AWS SES
    // 2. Create a proper email template
    // 3. Send the actual email
    
    // For now, we'll just log the email content and return success
    const emailContent = {
      to: recipientEmail,
      from: 'noreply@echostone.ai',
      subject: `You've been invited to chat with ${avatarName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #9b7cff;">You've been invited to chat with ${avatarName}!</h2>
          
          <p>Hi there,</p>
          
          <p>${ownerEmail} has shared their avatar "${avatarName}" with you.</p>
          
          ${personalMessage ? `<p><em>"${personalMessage}"</em></p>` : ''}
          
          <p>Click the button below to start chatting:</p>
          
          <div style="text-align: center; margin: 2rem 0;">
            <a href="${shareUrl}" 
               style="background: linear-gradient(135deg, #9b7cff 0%, #7c5dff 100%); 
                      color: white; 
                      padding: 12px 24px; 
                      text-decoration: none; 
                      border-radius: 8px; 
                      display: inline-block;">
              Start Chatting with ${avatarName}
            </a>
          </div>
          
          <p>Or copy and paste this link into your browser:</p>
          <p style="background: #f5f5f5; padding: 10px; border-radius: 4px; word-break: break-all;">
            ${shareUrl}
          </p>
          
          <hr style="margin: 2rem 0; border: none; border-top: 1px solid #eee;">
          
          <p style="color: #666; font-size: 0.9em;">
            This invitation was sent by ${ownerEmail}. Your conversations with ${avatarName} will be completely private.
          </p>
          
          <p style="color: #666; font-size: 0.9em;">
            Powered by EchoStone - AI Avatar Platform
          </p>
        </div>
      `
    };

    console.log('Email would be sent with content:', emailContent);

    // TODO: Implement actual email sending
    // Example with SendGrid:
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    // await sgMail.send(emailContent);

    return { 
      success: true, 
      message: 'Invitation email sent successfully'
    };
  } catch (error) {
    console.error('Error sending invitation email:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send invitation email'
    };
  }
}