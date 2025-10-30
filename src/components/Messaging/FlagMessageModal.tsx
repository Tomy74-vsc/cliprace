"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FlagMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  messageId: string;
  currentReason?: string;
}

export function FlagMessageModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  messageId, 
  currentReason 
}: FlagMessageModalProps) {
  const [reason, setReason] = useState(currentReason || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    setIsSubmitting(true);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (error) {
      console.error('Erreur lors du signalement:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="flag-modal-title"
        aria-describedby="flag-modal-description"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: "spring", duration: 0.3 }}
          className="w-full max-w-md rounded-lg border border-border/60 bg-background p-6 shadow-lg"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <h2 id="flag-modal-title" className="text-lg font-semibold">
                  Signaler un message
                </h2>
                <p id="flag-modal-description" className="text-sm text-muted-foreground">
                  Expliquez pourquoi ce message pose problème
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="flag-reason" className="block text-sm font-medium mb-2">
                Motif du signalement
              </label>
              <textarea
                id="flag-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Décrivez le problème avec ce message..."
                rows={4}
                className="w-full resize-none rounded-md border border-border/60 bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                required
                autoFocus
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Votre signalement sera examiné par notre équipe de modération.
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={!reason.trim() || isSubmitting}
                className="flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Signalement...
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4" />
                    Signaler
                  </>
                )}
              </Button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
