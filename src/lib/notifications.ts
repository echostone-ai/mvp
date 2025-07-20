/**
 * Interface for notification parameters
 */
interface NotificationParams {
  email: string;
  type: 'invitation' | 'flag' | 'new_memory';
  title: string;
  message: string;
  actionUrl?: string;
}

/**
 * Sends a notification email
 * @param params The notification parameters
 */
export async function sendNotification(params: NotificationParams): Promise<void> {
  const { email, type, title, message, actionUrl } = params;
  
  // In a real implementation, you would use a service like SendGrid, Mailgun, etc.
  // For now, we'll just log the notification
  console.log(`[NOTIFICATION] ${type.toUpperCase()} to ${email}:`);
  console.log(`Title: ${title}`);
  console.log(`Message: ${message}`);
  if (actionUrl) {
    console.log(`Action URL: ${actionUrl}`);
  }
  
  // Return a resolved promise to simulate successful sending
  return Promise.resolve();
}