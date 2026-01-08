'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type ToastType = 'success' | 'error' | 'warning' | 'info';

type AdminToastEnhancedProps = {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
  onClose: (id: string) => void;
};

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const colors = {
  success: 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400',
  error: 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400',
  warning: 'bg-orange-500/10 border-orange-500/20 text-orange-700 dark:text-orange-400',
  info: 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400',
};

/**
 * Toast notification premium avec animations
 * - Apparition/disparition fluide
- Progress bar pour auto-dismiss
- Icônes sémantiques
- Design moderne
 */
export function AdminToastEnhanced({
  id,
  type,
  title,
  description,
  duration = 5000,
  onClose,
}: AdminToastEnhancedProps) {
  const [progress, setProgress] = useState(100);
  const [isClosing, setIsClosing] = useState(false);
  const Icon = icons[type];

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => onClose(id), 300);
  }, [id, onClose]);

  useEffect(() => {
    if (duration > 0) {
      const interval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev - (100 / (duration / 100));
          if (newProgress <= 0) {
            handleClose();
            return 0;
          }
          return newProgress;
        });
      }, 100);

      return () => clearInterval(interval);
    }
  }, [duration, handleClose]);

  return (
    <div
      className={cn(
        'relative overflow-hidden',
        'rounded-2xl border backdrop-blur-xl',
        'shadow-lg',
        'min-w-[320px] max-w-md',
        'animate-slideInRight',
        isClosing && 'animate-fadeOut',
        colors[type],
        'p-4'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">{title}</div>
          {description && (
            <div className="mt-1 text-sm opacity-90">{description}</div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 flex-shrink-0"
          onClick={handleClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      {duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-current/20">
          <div
            className="h-full bg-current/40 transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}


