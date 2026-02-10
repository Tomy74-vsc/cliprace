'use client';

import { motion } from 'framer-motion';
import { ImageIcon, Trophy, Smartphone } from 'lucide-react';
import { useContestWizard } from '@/store/useContestWizard';
import { calculatePrizeDistribution } from '@/lib/contest-math';
import { formatCurrency, formatDate } from '@/lib/formatters';

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
};

export function LiveMobilePreview() {
  const { data, totalPriceCents, platformFeeCents } = useContestWizard();

  const isCash = data.contest_type === 'cash';
  const prizeAmountCents = data.prize_amount ?? 0;
  const podium = isCash ? calculatePrizeDistribution(prizeAmountCents) : [];

  const product = data.product_details;

  const totalPlatforms = data.platforms.length;

  return (
    <div className="hidden lg:block">
      <div className="sticky top-8">
        <motion.div
          layout
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.25 }}
          className="relative mx-auto w-full max-w-sm"
        >
          {/* Phone frame */}
          <div className="relative aspect-[9/19] rounded-[2.5rem] border border-border bg-gradient-to-b from-slate-900 via-slate-950 to-black shadow-2xl p-4 overflow-hidden">
            {/* Notch */}
            <div className="absolute inset-x-16 top-3 h-5 rounded-full bg-black/70 flex items-center justify-center">
              <div className="h-2 w-20 rounded-full bg-slate-700/80" />
            </div>

            {/* Screen */}
            <div className="relative mt-8 h-full rounded-[1.75rem] bg-slate-900/70 backdrop-blur-md border border-white/5 shadow-inner overflow-hidden flex flex-col">
              {/* Header */}
              <div className="px-4 pt-4 pb-3 border-b border-white/5 flex items-center gap-3">
                <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-md">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    Aperçu concours
                  </p>
                  <p className="truncate text-sm font-semibold">
                    {data.title ? (
                      <span className="text-slate-50">{data.title}</span>
                    ) : (
                      <span className="text-slate-500">Titre de votre concours...</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 px-4 py-3 space-y-3 overflow-hidden">
                {/* Top block: reward */}
                <motion.div
                  key={isCash ? 'cash' : 'product'}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-2xl bg-slate-900/70 border border-white/10 shadow-sm p-3 flex gap-3"
                >
                  <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-slate-900 shadow-lg">
                    {isCash ? <Trophy className="h-6 w-6" /> : <ImageIcon className="h-6 w-6" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-amber-300/80">
                      {isCash ? 'Concours Cash' : 'Concours Produit'}
                    </p>
                    {isCash ? (
                      <div className="mt-1">
                        <p className="text-lg font-semibold text-slate-50 leading-tight">
                          {prizeAmountCents > 0
                            ? formatCurrency(prizeAmountCents, 'EUR')
                            : 'Montant à définir'}
                        </p>
                        {podium.length > 0 && (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            1er {formatCurrency(podium[0].amount_cents, 'EUR')} • 2ème{' '}
                            {podium[1] ? formatCurrency(podium[1].amount_cents, 'EUR') : '—'}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="mt-1 space-y-0.5">
                        <p className="text-sm font-semibold text-slate-50 leading-tight line-clamp-1">
                          {product?.name || 'Nom du produit'}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Valeur perçue{' '}
                          <span className="font-semibold text-emerald-300">
                            {product?.value
                              ? formatCurrency(product.value, 'EUR')
                              : 'à définir'}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Media / product visual */}
                <div className="rounded-2xl overflow-hidden bg-slate-800/70 border border-white/10 h-32 relative">
                  {isCash ? (
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/40 via-emerald-400/20 to-emerald-500/40" />
                  ) : product?.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.image_url}
                      alt={product.name || 'Produit'}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-1 text-slate-300">
                        <ImageIcon className="h-5 w-5" />
                        <span className="text-[11px] font-medium">
                          Image produit (optionnelle)
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                  <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] text-slate-200">
                    <span className="truncate">
                      {isCash ? 'Cashprize garanti' : 'Produit envoyé aux gagnants'}
                    </span>
                    {totalPlatforms > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-black/60 text-[10px] font-medium">
                        {totalPlatforms} plateforme{totalPlatforms > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Brief
                  </p>
                  <p className="text-xs text-slate-200 leading-snug line-clamp-3">
                    {data.description ||
                      "Ajoute une description claire de ce que tu attends des créateurs."}
                  </p>
                </div>

                {/* Dates + platforms */}
                <div className="flex flex-col gap-2 text-[11px] text-slate-300">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">Période</span>
                    <span className="font-medium text-slate-100 text-right">
                      {formatDate(data.start_at, { day: '2-digit', month: 'short' })} →{' '}
                      {formatDate(data.end_at, { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-0.5">
                    {data.platforms.length > 0 ? (
                      data.platforms.map((p) => (
                        <span
                          key={p}
                          className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-800/80 border border-white/10 text-[11px] font-medium text-slate-100"
                        >
                          {PLATFORM_LABELS[p] ?? p}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-500">
                        Sélectionne au moins une plateforme
                      </span>
                    )}
                  </div>
                </div>

                {/* Ticket footer */}
                <div className="mt-2 rounded-2xl border border-amber-400/25 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent px-3 py-2.5 text-[11px] text-slate-100 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="uppercase tracking-[0.18em] text-[10px] text-amber-200/80 font-semibold">
                      Ticket récap
                    </p>
                    <p className="text-[11px] text-slate-300">
                      Frais plateforme{' '}
                      <span className="font-semibold text-amber-200">
                        {formatCurrency(platformFeeCents, 'EUR')}
                      </span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400">Total estimé</p>
                    <p className="text-sm font-semibold text-amber-100">
                      {formatCurrency(totalPriceCents + platformFeeCents, 'EUR')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

