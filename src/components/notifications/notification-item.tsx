'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Bell, CreditCard, MessageSquare, Upload, MoreHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useToastContext } from '@/hooks/use-toast-context';
import { useCsrfToken } from '@/hooks/use-csrf-token';

export type NotificationType = 'message_new' | 'submission_moderated' | 'payout' | 'default';

export type NotificationRow = {
  id: string;
  type: NotificationType;
  read: boolean;
  created_at: string;
  title: string;
  message: string;
  actionUrl?: string;
};

function NotificationIcon({ type }: { type: NotificationType }) {
  switch (type) {
    case 'payout':
      return <CreditCard className="h-4 w-4 text-primary" />;
    case 'message_new':
      return <MessageSquare className="h-4 w-4 text-primary" />;
    case 'submission_moderated':
      return <Upload className="h-4 w-4 text-primary" />;
    default:
      return <Bell className="h-4 w-4 text-primary" />;
  }
}

interface NotificationItemProps {
  notification: NotificationRow;
}

export function NotificationItem({ notification }: NotificationItemProps) {
  const { toast } = useToastContext();
  const csrfToken = useCsrfToken();
  const router = useRouter();

  const handleMarkAsRead = async () => {
    if (notification.read) return;
    try {
      const response = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf': csrfToken || '',
        },
        body: JSON.stringify({ ids: [notification.id] }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Impossible de mettre à jour la notification');
      }
      toast({
        type: 'success',
        title: 'Notification mise à jour',
        message: 'Notification marquée comme lue.',
      });
      router.refresh();
    } catch (error) {
      toast({
        type: 'error',
        title: 'Erreur',
        message: error instanceof Error ? error.message : 'Une erreur est survenue',
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={`rounded-lg border border-border p-3 flex flex-col gap-2 ${
        notification.read ? 'opacity-75' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <NotificationIcon type={notification.type} />
          <div>
            <p className="text-sm font-semibold text-foreground">{notification.title}</p>
            <p className="text-xs text-muted-foreground">{notification.message}</p>
          </div>
        </div>
        {!notification.read && <Badge variant="info">Non lu</Badge>}
      </div>

      {notification.type === 'payout' && (
        <Alert>
          <AlertTitle>Paiement</AlertTitle>
          <AlertDescription>Consulte ton portefeuille pour suivre ce paiement.</AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          {new Intl.DateTimeFormat('fr-FR', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date(notification.created_at))}
        </span>
        {notification.actionUrl && (
          <Link href={notification.actionUrl} className="text-primary hover:underline font-medium">
            Ouvrir
          </Link>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs px-2 ml-auto">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Actions notification</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!notification.read && (
              <DropdownMenuItem
                onClick={() => {
                  void handleMarkAsRead();
                }}
              >
                Marquer comme lue
              </DropdownMenuItem>
            )}
            {notification.actionUrl && (
              <DropdownMenuItem asChild>
                <Link href={notification.actionUrl}>Ouvrir</Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
}

