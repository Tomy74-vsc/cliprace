"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Shield, Trash2, CheckCircle, Eye, User, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getBrowserSupabase } from '@/lib/supabase/client';

interface FlaggedMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  flagged: boolean;
  flagged_at: string;
  flagged_by: string;
  flagged_reason: string;
  created_at: string;
  sender_name: string;
  sender_handle: string;
  brand_name: string;
  creator_name: string;
}

interface FlaggedStats {
  total_flagged: number;
  flagged_today: number;
  flagged_this_week: number;
  flagged_this_month: number;
}

export default function AdminFlaggedMessagesPage() {
  const supabase = getBrowserSupabase();
  const [messages, setMessages] = useState<FlaggedMessage[]>([]);
  const [stats, setStats] = useState<FlaggedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadFlaggedMessages = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.rpc('get_flagged_messages', {
        p_limit: 50,
        p_offset: 0
      });

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error('Erreur chargement messages signalés:', err);
      setError('Impossible de charger les messages signalés');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_flagged_messages_stats');
      if (error) throw error;
      setStats(data?.[0] || null);
    } catch (err) {
      console.error('Erreur chargement stats:', err);
    }
  };

  useEffect(() => {
    loadFlaggedMessages();
    loadStats();
  }, []);

  const handleUnflag = async (messageId: string) => {
    try {
      setActionLoading(messageId);
      const { error } = await supabase.rpc('unflag_message', {
        p_message_id: messageId
      });

      if (error) throw error;
      
      // Recharger les données
      await loadFlaggedMessages();
      await loadStats();
    } catch (err) {
      console.error('Erreur déflaguer message:', err);
      setError('Impossible de déflaguer le message');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce message ? Cette action est irréversible.')) {
      return;
    }

    try {
      setActionLoading(messageId);
      const { error } = await supabase.rpc('delete_flagged_message', {
        p_message_id: messageId,
        p_reason: 'Supprimé par admin'
      });

      if (error) throw error;
      
      // Recharger les données
      await loadFlaggedMessages();
      await loadStats();
    } catch (err) {
      console.error('Erreur suppression message:', err);
      setError('Impossible de supprimer le message');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-zinc-200 dark:bg-zinc-800 rounded-2xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
            Messages signalés
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Gestion des messages signalés par les utilisateurs
          </p>
        </div>
        <Button onClick={loadFlaggedMessages} variant="outline">
          Actualiser
        </Button>
      </motion.div>

      {/* Stats */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid grid-cols-1 gap-4 md:grid-cols-4"
        >
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-sm font-medium text-red-600">Total signalés</p>
                <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                  {stats.total_flagged}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-6 dark:border-orange-800 dark:bg-orange-950">
            <div className="flex items-center gap-3">
              <Calendar className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-orange-600">Aujourd'hui</p>
                <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                  {stats.flagged_today}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-6 dark:border-yellow-800 dark:bg-yellow-950">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-yellow-600" />
              <div>
                <p className="text-sm font-medium text-yellow-600">Cette semaine</p>
                <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                  {stats.flagged_this_week}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-800 dark:bg-blue-950">
            <div className="flex items-center gap-3">
              <Eye className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-600">Ce mois</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {stats.flagged_this_month}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-destructive"
        >
          {error}
        </motion.div>
      )}

      {/* Messages list */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="space-y-4"
      >
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <h3 className="mt-4 text-lg font-semibold">Aucun message signalé</h3>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Tous les messages sont conformes aux règles de la plateforme
            </p>
          </div>
        ) : (
          messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-950"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="destructive">Signalé</Badge>
                    <span className="text-sm text-muted-foreground">
                      {new Date(message.flagged_at).toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="mb-3">
                    <p className="text-sm font-medium text-foreground mb-1">
                      Message de {message.sender_name} (@{message.sender_handle})
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Conversation: {message.brand_name} ↔ {message.creator_name}
                    </p>
                  </div>

                  <div className="rounded-md border border-red-200 bg-white p-3 dark:border-red-700 dark:bg-red-900">
                    <p className="text-sm text-foreground">{message.body}</p>
                  </div>

                  {message.flagged_reason && (
                    <div className="mt-3">
                      <p className="text-xs font-medium text-red-600 mb-1">Motif du signalement:</p>
                      <p className="text-sm text-red-700 dark:text-red-300">{message.flagged_reason}</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 ml-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleUnflag(message.id)}
                    disabled={actionLoading === message.id}
                    className="flex items-center gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {actionLoading === message.id ? 'Traitement...' : 'Déflaguer'}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(message.id)}
                    disabled={actionLoading === message.id}
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    {actionLoading === message.id ? 'Suppression...' : 'Supprimer'}
                  </Button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </motion.div>
    </div>
  );
}
