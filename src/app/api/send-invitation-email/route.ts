import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      recipientEmail, 
      avatarName, 
      ownerEmail, 
      shareUrl, 
      personalMessage 
    } = body;

    if (!recipientEmail || !avatarName || !shareUrl) {
      return NextResponse.json({ 
        error: 'Recipient email, avatar name, and share URL are required' 
      }, { status: 400 });
    }

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

    return NextResponse.json({ 
      success: true, 
      message: 'Invitation email sent successfully',
      // For development, return the email content so you can see what would be sent
      emailContent: process.env.NODE_ENV === 'development' ? emailContent : undefined
    });

  } catch (error) {
    console.error('Error sending invitation email:', error);
    return NextResponse.json({ 
      error: 'Failed to send invitation email' 
    }, { status: 500 });
  }
}