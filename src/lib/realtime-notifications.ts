import { getBrowserSupabase } from '@/lib/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface NotificationSubscriptionOptions {
  onNotification?: (notification: unknown) => void;
  onError?: (error: Error) => void;
  onStatusChange?: (status: string) => void;
}

/**
 * Subscribe to real-time notifications for a user
 */
export function subscribeToNotifications(
  userId: string,
  options: NotificationSubscriptionOptions = {}
): RealtimeChannel {
  const supabase = getBrowserSupabase();
  
  const channel = supabase
    .channel(`notifications:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        console.log('New notification received:', payload);
        options.onNotification?.(payload.new);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        console.log('Notification updated:', payload);
        options.onNotification?.(payload.new);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        console.log('Notification deleted:', payload);
        options.onNotification?.(payload.old);
      }
    )
    .subscribe((status) => {
      console.log('Notification subscription status:', status);
      options.onStatusChange?.(status);
      
      if (status === 'SUBSCRIBED') {
        console.log('Successfully subscribed to notifications');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('Error subscribing to notifications');
        options.onError?.(new Error('Failed to subscribe to notifications'));
      }
    });

  return channel;
}

/**
 * Unsubscribe from notifications
 */
export function unsubscribeFromNotifications(channel: RealtimeChannel): void {
  const supabase = getBrowserSupabase();
  supabase.removeChannel(channel);
}

/**
 * Sample usage in a React component
 * Note: This requires React imports in the actual component file
 */
export function useRealtimeNotifications(_userId: string) {
  // Suppress unused parameter warning
  void _userId;
  // This is a sample implementation - in practice, you'd import React hooks
  // const [notifications, setNotifications] = useState<unknown[]>([]);
  // const [isConnected, setIsConnected] = useState(false);
  // const [error, setError] = useState<string | null>(null);
  // const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  // useEffect(() => {
  //   if (!userId) return;

  //   const newChannel = subscribeToNotifications(userId, {
  //     onNotification: (notification) => {
  //       setNotifications(prev => [notification, ...prev]);
  //     },
  //     onError: (err) => {
  //       setError(err.message);
  //     },
  //     onStatusChange: (status) => {
  //       setIsConnected(status === 'SUBSCRIBED');
  //     }
  //   });

  //   setChannel(newChannel);

  //   return () => {
  //     if (newChannel) {
  //       unsubscribeFromNotifications(newChannel);
  //     }
  //   };
  // }, [userId]);

  // return {
  //   notifications,
  //   isConnected,
  //   error,
  //   channel
  // };

  // Placeholder return for TypeScript
  return {
    notifications: [],
    isConnected: false,
    error: null,
    channel: null
  };
}

/**
 * Sample client-side notification subscription code
 */
export const sampleClientCode = `
// 1. Basic subscription setup
import { subscribeToNotifications, unsubscribeFromNotifications } from '@/lib/realtime-notifications';

const userId = 'user-uuid-here';
let notificationChannel = null;

// Subscribe to notifications
notificationChannel = subscribeToNotifications(userId, {
  onNotification: (notification) => {
    console.log('New notification:', notification);
    // Update UI, show toast, etc.
  },
  onError: (error) => {
    console.error('Notification error:', error);
  },
  onStatusChange: (status) => {
    console.log('Subscription status:', status);
  }
});

// Unsubscribe when done
unsubscribeFromNotifications(notificationChannel);

// 2. React hook usage
import { useRealtimeNotifications } from '@/lib/realtime-notifications';

function NotificationComponent() {
  const { notifications, isConnected, error } = useRealtimeNotifications(userId);
  
  return (
    <div>
      <p>Connection status: {isConnected ? 'Connected' : 'Disconnected'}</p>
      {error && <p>Error: {error}</p>}
      <div>
        {notifications.map(notification => (
          <div key={notification.id}>
            {notification.type}: {notification.payload}
          </div>
        ))}
      </div>
    </div>
  );
}

// 3. Manual subscription in useEffect
import { useEffect, useState } from 'react';
import { subscribeToNotifications, unsubscribeFromNotifications } from '@/lib/realtime-notifications';

function MyComponent() {
  const [notifications, setNotifications] = useState([]);
  const [channel, setChannel] = useState(null);

  useEffect(() => {
    const userId = 'your-user-id';
    
    const newChannel = subscribeToNotifications(userId, {
      onNotification: (notification) => {
        setNotifications(prev => [notification, ...prev]);
      }
    });
    
    setChannel(newChannel);
    
    return () => {
      if (newChannel) {
        unsubscribeFromNotifications(newChannel);
      }
    };
  }, []);

  return (
    <div>
      {notifications.map(notification => (
        <div key={notification.id}>
          {notification.type}
        </div>
      ))}
    </div>
  );
}
`;

/**
 * WebSocket connection status monitoring
 */
export function getConnectionStatus(): 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR' {
  // This would need to be implemented based on your Supabase setup
  // For now, return a placeholder
  return 'CONNECTED';
}

/**
 * Reconnect to notifications if connection is lost
 */
export function reconnectNotifications(
  userId: string,
  options: NotificationSubscriptionOptions = {}
): RealtimeChannel {
  console.log('Reconnecting to notifications...');
  return subscribeToNotifications(userId, options);
}
