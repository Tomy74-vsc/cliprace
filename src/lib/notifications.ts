import { getServerSupabase } from '@/lib/supabase/server';

export type NotificationType = 
  | 'submission_received'
  | 'submission_status'
  | 'payment_received'
  | 'contest_approved'
  | 'contest_rejected'
  | 'new_contest'
  | 'system';

export interface NotificationPayload {
  submission_id?: string;
  contest_id?: string;
  status?: string;
  amount_cents?: number;
  reason?: string;
  [key: string]: unknown;
}

export interface NotificationPreferences {
  email_notifications: boolean;
  push_notifications: boolean;
  in_app_notifications: boolean;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

/**
 * Create a notification for a user
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  payload: NotificationPayload = {}
): Promise<{ success: boolean; notification?: unknown; error?: string }> {
  try {
    const supabase = await getServerSupabase();
    
    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id, email_notifications, push_notifications, in_app_notifications')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return { success: false, error: 'User not found' };
    }

    // Create the notification
    const { data: notification, error: notificationError } = await supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        payload,
        read: false
      })
      .select()
      .single();

    if (notificationError) {
      console.error('Error creating notification:', notificationError);
      return { success: false, error: 'Failed to create notification' };
    }

    // Send email notification if enabled
    if (user.email_notifications) {
      await sendEmailNotification(userId, type, payload);
    }

    // Send push notification if enabled
    if (user.push_notifications) {
      await sendPushNotification(userId, type, payload);
    }

    return { success: true, notification };
  } catch (error) {
    console.error('Error in createNotification:', error);
    return { success: false, error: 'Internal server error' };
  }
}

/**
 * Mark a notification as read
 */
export async function markAsRead(
  notificationId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await getServerSupabase();
    
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error marking notification as read:', error);
      return { success: false, error: 'Failed to mark notification as read' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in markAsRead:', error);
    return { success: false, error: 'Internal server error' };
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await getServerSupabase();
    
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      console.error('Error marking all notifications as read:', error);
      return { success: false, error: 'Failed to mark all notifications as read' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in markAllAsRead:', error);
    return { success: false, error: 'Internal server error' };
  }
}

/**
 * Get user notification preferences
 */
export async function getNotificationPreferences(
  userId: string
): Promise<{ success: boolean; preferences?: NotificationPreferences; error?: string }> {
  try {
    const supabase = await getServerSupabase();
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('email_notifications, push_notifications, in_app_notifications')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      return { success: false, error: 'User not found' };
    }

    return {
      success: true,
      preferences: {
        email_notifications: profile.email_notifications || false,
        push_notifications: profile.push_notifications || false,
        in_app_notifications: profile.in_app_notifications || true
      }
    };
  } catch (error) {
    console.error('Error in getNotificationPreferences:', error);
    return { success: false, error: 'Internal server error' };
  }
}

/**
 * Update user notification preferences
 */
export async function updateNotificationPreferences(
  userId: string,
  preferences: Partial<NotificationPreferences>
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await getServerSupabase();
    
    const { error } = await supabase
      .from('profiles')
      .update(preferences)
      .eq('id', userId);

    if (error) {
      console.error('Error updating notification preferences:', error);
      return { success: false, error: 'Failed to update preferences' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in updateNotificationPreferences:', error);
    return { success: false, error: 'Internal server error' };
  }
}

/**
 * Send email notification using SendGrid
 */
async function sendEmailNotification(
  userId: string,
  type: NotificationType,
  payload: NotificationPayload
): Promise<void> {
  try {
    const supabase = await getServerSupabase();
    
    // Get user email and name
    const { data: user } = await supabase
      .from('profiles')
      .select('email, name')
      .eq('id', userId)
      .single();

    if (!user?.email) return;

    // Import and use the email service
    const { sendNotificationEmail } = await import('./email');
    
    await sendNotificationEmail(
      user.email,
      type,
      payload,
      { name: user.name, email: user.email }
    );
  } catch (error) {
    console.error('Error sending email notification:', error);
  }
}

/**
 * Send push notification
 */
async function sendPushNotification(
  userId: string,
  type: NotificationType,
  payload: NotificationPayload
): Promise<void> {
  try {
    // Get user's push tokens
    const supabase = await getServerSupabase();
    const { data: tokens } = await supabase
      .from('user_push_tokens')
      .select('token')
      .eq('user_id', userId);

    if (!tokens?.length) return;

    // Send push notification (you'll need to implement this)
    const message = getPushMessage(type, payload);
    
    for (const { token } of tokens) {
      await sendPushMessage(token, message);
    }
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}


/**
 * Get push message for notification type
 */
function getPushMessage(type: NotificationType, payload: NotificationPayload) {
  switch (type) {
    case 'submission_received':
      return {
        title: 'Nouvelle soumission',
        body: 'Vous avez reçu une nouvelle soumission'
      };
    
    case 'submission_status':
      return {
        title: 'Statut de soumission',
        body: `Votre soumission a été ${payload.status}`
      };
    
    case 'payment_received':
      return {
        title: 'Paiement reçu',
        body: `Vous avez reçu ${(payload.amount_cents || 0) / 100}€`
      };
    
    default:
      return {
        title: 'Notification ClipRace',
        body: 'Nouvelle notification'
      };
  }
}


/**
 * Send push message (placeholder - implement with your push service)
 */
async function sendPushMessage(token: string, message: {
  title: string;
  body: string;
}): Promise<void> {
  // TODO: Implement push notification service
  console.log('Push notification:', { token, message });
}

/**
 * Get notification count for user
 */
export async function getNotificationCount(
  userId: string,
  unreadOnly: boolean = true
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const supabase = await getServerSupabase();
    
    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (unreadOnly) {
      query = query.eq('read', false);
    }

    const { count, error } = await query;

    if (error) {
      console.error('Error getting notification count:', error);
      return { success: false, error: 'Failed to get notification count' };
    }

    return { success: true, count: count || 0 };
  } catch (error) {
    console.error('Error in getNotificationCount:', error);
    return { success: false, error: 'Internal server error' };
  }
}
