'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Check, ChevronRight } from 'lucide-react';
import { useToastContext } from '@/hooks/use-toast-context';
import { useCsrfToken } from '@/hooks/use-csrf-token';
import { track } from '@/lib/analytics';

export interface CashoutSliderProps {
  balanceCents: number;
  currency: string;
  disabled?: boolean;
  className?: string;
}

function formatCurrency(cents: number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

const DRAG_THRESHOLD_PX = 180;
const DRAG_MAX_PX = 220;

export function CashoutSlider({
  balanceCents,
  currency,
  disabled = false,
  className,
}: CashoutSliderProps) {
  const router = useRouter();
  const { toast } = useToastContext();
  const csrfToken = useCsrfToken();
  const [status, setStatus] = useState<'idle' | 'dragging' | 'loading' | 'success' | 'error'>('idle');
  const [successVisible, setSuccessVisible] = useState(false);
  const constraintRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const width = useRef(0);

  const scale = useTransform(x, [0, 150], [1, 1.02]);
  const opacity = useTransform(x, [0, 80], [0.6, 1]);

  const handleDragEnd = async (_: unknown, info: PanInfo) => {
    if (status !== 'idle' && status !== 'dragging') return;
    const offset = info.offset.x;
    if (offset >= DRAG_THRESHOLD_PX) {
      setStatus('loading');
      try {
        track('start_cashout', { amount_cents: balanceCents });
        const res = await fetch('/api/payments/creator/cashout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf': csrfToken || '',
          },
          body: JSON.stringify({ amount_cents: balanceCents }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.message || 'Erreur lors du retrait');
        setStatus('success');
        setSuccessVisible(true);
        toast({
          type: 'success',
          title: 'Demande enregistrée',
          message: 'Ton retrait sera traité sous quelques jours.',
        });
        setTimeout(() => router.refresh(), 800);
      } catch (e) {
        setStatus('error');
        toast({
          type: 'error',
          title: 'Erreur',
          message: e instanceof Error ? e.message : 'Une erreur est survenue',
        });
        setTimeout(() => setStatus('idle'), 1500);
      }
    } else {
      setStatus('idle');
    }
    x.set(0);
  };

  const isDisabled = disabled || balanceCents <= 0 || status === 'loading' || status === 'success';

  return (
    <div ref={constraintRef} className={className}>
      <p className="mb-2 text-xs text-white/50">Glisse pour confirmer le retrait</p>
      <motion.div
        className="relative h-12 w-full rounded-xl bg-white/5"
        style={{ scale }}
      >
        <motion.div
          drag={isDisabled ? false : 'x'}
          dragConstraints={{ left: 0, right: DRAG_MAX_PX }}
          dragElastic={0.05}
          onDragStart={() => setStatus('dragging')}
          onDragEnd={handleDragEnd}
          style={{ x }}
          className="absolute left-0 top-0 flex h-12 cursor-grab items-center rounded-xl active:cursor-grabbing"
          whileTap={isDisabled ? undefined : { scale: 1.01 }}
        >
          <motion.div
            className="flex h-12 min-w-[140px] items-center justify-center gap-2 rounded-xl bg-emerald-500/90 px-4 text-sm font-semibold text-white shadow-lg"
            style={{ opacity }}
          >
            {status === 'success' && successVisible ? (
              <>
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  <Check className="h-5 w-5" />
                </motion.span>
                <span>Enregistré</span>
              </>
            ) : status === 'loading' ? (
              <span className="animate-pulse">Traitement…</span>
            ) : (
              <>
                <span>Retirer {formatCurrency(balanceCents, currency)}</span>
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}
