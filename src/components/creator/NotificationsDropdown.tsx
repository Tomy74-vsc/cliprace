"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, X, Trophy, Euro, Users, AlertCircle } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";

export function NotificationsDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const { 
    notifications, 
    unreadCount, 
    loading, 
    error, 
    markAsRead, 
    markAllAsRead 
  } = useNotifications();

  const getNotificationIcon = (type: string, payload: Record<string, unknown>) => {
    switch (type) {
      case 'submission_status':
        return (payload.status as string) === 'approved' ? 
          <Trophy className="h-4 w-4 text-green-500" /> : 
          <X className="h-4 w-4 text-red-500" />;
      case 'payment_received':
        return <Euro className="h-4 w-4 text-amber-500" />;
      case 'submission_received':
        return <Users className="h-4 w-4 text-blue-500" />;
      case 'new_contest':
        return <Users className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-zinc-500" />;
    }
  };

  const getNotificationTitle = (type: string, payload: Record<string, unknown>) => {
    switch (type) {
      case 'submission_received':
        return 'Nouvelle soumission reçue';
      case 'submission_status':
        return (payload.status as string) === 'approved' ? 'Soumission approuvée !' : 'Soumission rejetée';
      case 'payment_received':
        return 'Paiement reçu';
      case 'new_contest':
        return 'Nouveau concours disponible';
      default:
        return 'Notification';
    }
  };

  const getNotificationMessage = (type: string, payload: Record<string, unknown>) => {
    switch (type) {
      case 'submission_received':
        return 'Vous avez reçu une nouvelle soumission pour votre concours.';
      case 'submission_status':
        return (payload.status as string) === 'approved' 
          ? 'Votre soumission a été approuvée.' 
          : `Votre soumission a été rejetée.${payload.reason ? ` Raison: ${payload.reason}` : ''}`;
      case 'payment_received':
        return `Vous avez reçu ${((payload.amount_cents as number) || 0) / 100}€.`;
      case 'new_contest':
        return 'Un nouveau concours est maintenant disponible.';
      default:
        return 'Nouvelle notification';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'À l\'instant';
    if (diffInMinutes < 60) return `Il y a ${diffInMinutes}min`;
    if (diffInMinutes < 1440) return `Il y a ${Math.floor(diffInMinutes / 60)}h`;
    return `Il y a ${Math.floor(diffInMinutes / 1440)}j`;
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications" 
        className="relative rounded-lg p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      >
        <Bell className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800 z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-700">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  Tout marquer comme lu
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-sm text-zinc-500">
                  Chargement...
                </div>
              ) : error ? (
                <div className="p-4 text-center text-sm text-red-500">
                  Erreur: {error}
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="mx-auto h-8 w-8 text-zinc-400" />
                  <p className="mt-2 text-sm text-zinc-500">Aucune notification</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
                  {notifications.map((notification) => (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`p-4 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors ${
                        !notification.read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification.type, notification.payload)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className={`text-sm font-medium ${
                                !notification.read 
                                  ? 'text-zinc-900 dark:text-zinc-100' 
                                  : 'text-zinc-700 dark:text-zinc-300'
                              }`}>
                                {getNotificationTitle(notification.type, notification.payload)}
                              </p>
                              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                                {getNotificationMessage(notification.type, notification.payload)}
                              </p>
                            </div>
                            {!notification.read && (
                              <button
                                onClick={() => markAsRead(notification.id)}
                                aria-label="Marquer comme lu"
                                className="flex-shrink-0 rounded-full p-1 hover:bg-zinc-200 dark:hover:bg-zinc-600"
                              >
                                <Check className="h-3 w-3 text-zinc-500" />
                              </button>
                            )}
                          </div>
                          <p className="mt-2 text-xs text-zinc-500">
                            {formatTimeAgo(notification.created_at)}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="border-t border-zinc-200 p-3 dark:border-zinc-700">
                <button className="w-full text-center text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
                  Voir toutes les notifications
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
