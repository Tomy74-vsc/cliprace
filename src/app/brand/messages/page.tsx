"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Plus, ArrowLeft, Users } from 'lucide-react';
import Link from 'next/link';
import { MessagingPanel } from '@/components/Messaging';
import { Button } from '@/components/ui/button';

export default function BrandMessagesPage() {
  const [showNewThread, setShowNewThread] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <Link
            href="/brand"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au dashboard
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            Messagerie
          </h1>
          <Button
            onClick={() => setShowNewThread(true)}
            className="inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Nouvelle conversation
          </Button>
        </div>
      </motion.div>

      {/* Messaging Panel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="h-[calc(100vh-200px)] rounded-lg border border-border/60 bg-background/80"
      >
        <MessagingPanel />
      </motion.div>

      {/* New Thread Modal Placeholder */}
      {showNewThread && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-md rounded-lg border border-border/60 bg-background p-6 shadow-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Nouvelle conversation</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNewThread(false)}
              >
                ✕
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Pour créer une nouvelle conversation, contactez un créateur depuis la page de vos concours.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowNewThread(false)}
              >
                Fermer
              </Button>
              <Link href="/brand/contests">
                <Button>
                  Mes concours
                </Button>
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
