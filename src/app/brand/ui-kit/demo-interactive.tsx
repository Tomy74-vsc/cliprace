'use client';

/**
 * DemoInteractive — Client island for interactive sections
 * of the Brand UI Kit demo page.
 *
 * Sections:
 * 5. KPIs (KpiHero with animated numbers)
 * 6. Feedback (sonner toast + ActionDialog)
 * 7. RiveLoader + BrandDrawer
 */
import { useState } from 'react';
import { Toaster, toast } from 'sonner';
import { GlassCard } from '@/components/brand-ui/GlassCard';
import { KpiHero } from '@/components/brand-ui/KpiHero';
import { ActionDialog } from '@/components/brand-ui/ActionDialog';
import { BrandDrawer } from '@/components/brand-ui/BrandDrawer';
import { RiveLoader } from '@/components/brand-ui/RiveLoader';

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold text-[var(--text-1)] brand-tracking">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function DemoInteractive() {
  const [kpiValue, setKpiValue] = useState(12847);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dangerDialogOpen, setDangerDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const randomizeKpi = () => {
    setKpiValue(Math.floor(Math.random() * 50000) + 1000);
  };

  return (
    <>
      {/* Sonner Toaster (scoped to this demo) */}
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: 'var(--surface-1)',
            border: '1px solid var(--border-1)',
            color: 'var(--text-1)',
          },
        }}
      />

      {/* ══════════════════════════════════════════
          5. KPIs
          ══════════════════════════════════════════ */}
      <Section title="5. KPIs (NumberFlow)">
        <GlassCard effect="beam" notched>
          <div className="space-y-6">
            <div className="grid gap-8 sm:grid-cols-3">
              <KpiHero
                value={kpiValue}
                label="Total views"
                delta={12.4}
                suffix="views"
              />
              <KpiHero
                value={Math.round(kpiValue * 0.032)}
                label="Submissions"
                delta={-2.1}
              />
              <KpiHero
                value={Math.round(kpiValue * 0.78)}
                label="Prize pool"
                prefix="€"
                delta={0}
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={randomizeKpi}
                className="rounded-[var(--r2)] bg-[var(--cta-bg)] px-4 py-2 text-sm font-medium text-[var(--cta-fg)] hover:bg-white/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-void)]"
              >
                Randomize values
              </button>
              <span className="text-xs text-[var(--text-3)]">
                Click to see NumberFlow animation
              </span>
            </div>

            {/* Loading state */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-3)] mb-3">
                Loading state
              </p>
              <KpiHero value={0} label="Loading..." loading />
            </div>
          </div>
        </GlassCard>
      </Section>

      {/* ══════════════════════════════════════════
          6. FEEDBACK
          ══════════════════════════════════════════ */}
      <Section title="6. Feedback">
        <GlassCard>
          <div className="space-y-6">
            {/* Toasts */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-3)] mb-3">
                Sonner Toasts
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() =>
                    toast.success('Campaign created', {
                      description: 'Your campaign is now live.',
                    })
                  }
                  className="rounded-[var(--r2)] border border-[var(--border-1)] px-3 py-2 text-sm text-[var(--text-2)] hover:text-[var(--text-1)] hover:border-[var(--border-2)] transition-colors"
                >
                  Success toast
                </button>
                <button
                  type="button"
                  onClick={() =>
                    toast.error('Payment failed', {
                      description: 'Check your card details and try again.',
                    })
                  }
                  className="rounded-[var(--r2)] border border-[var(--border-1)] px-3 py-2 text-sm text-[var(--text-2)] hover:text-[var(--text-1)] hover:border-[var(--border-2)] transition-colors"
                >
                  Error toast
                </button>
                <button
                  type="button"
                  onClick={() =>
                    toast.info('New submission received', {
                      description: 'A creator submitted content for review.',
                    })
                  }
                  className="rounded-[var(--r2)] border border-[var(--border-1)] px-3 py-2 text-sm text-[var(--text-2)] hover:text-[var(--text-1)] hover:border-[var(--border-2)] transition-colors"
                >
                  Info toast
                </button>
              </div>
            </div>

            {/* ActionDialog */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-3)] mb-3">
                ActionDialog
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setDialogOpen(true)}
                  className="rounded-[var(--r2)] bg-[var(--cta-bg)] px-4 py-2 text-sm font-medium text-[var(--cta-fg)] hover:bg-white/90 transition-colors"
                >
                  Open default dialog
                </button>
                <button
                  type="button"
                  onClick={() => setDangerDialogOpen(true)}
                  className="rounded-[var(--r2)] bg-[var(--brand-danger)] px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors"
                >
                  Open danger dialog
                </button>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* Dialogs (portaled) */}
        <ActionDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title="Publish campaign"
          description="This will make the campaign visible to all creators on ClipRace. You can pause it later."
          confirmLabel="Publish"
          onConfirm={() => {
            setDialogOpen(false);
            toast.success('Campaign published');
          }}
        />
        <ActionDialog
          open={dangerDialogOpen}
          onOpenChange={setDangerDialogOpen}
          intent="danger"
          title="Close campaign"
          description="This action is irreversible. All pending submissions will be rejected and the prize pool will be finalized."
          confirmLabel="Close campaign"
          cancelLabel="Keep open"
          onConfirm={() => {
            setDangerDialogOpen(false);
            toast.success('Campaign closed');
          }}
        />
      </Section>

      {/* ══════════════════════════════════════════
          7. RIVE LOADER + DRAWER
          ══════════════════════════════════════════ */}
      <Section title="7. Loader &amp; Drawer">
        <div className="grid gap-6 sm:grid-cols-2">
          {/* RiveLoader */}
          <GlassCard>
            <div className="space-y-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
                RiveLoader
              </p>
              <p className="text-sm text-[var(--text-2)]">
                Falls back to lucide Loader2 spinner. Rive animation loads
                lazily when a valid .riv URL is provided.
              </p>
              <div className="flex items-center gap-6">
                <div className="flex flex-col items-center gap-2">
                  <RiveLoader className="w-16 h-16" label="Loading data" />
                  <span className="text-[10px] text-[var(--text-3)]">
                    Animated spinner
                  </span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <RiveLoader className="w-16 h-16" label="Static loader" />
                  <span className="text-[10px] text-[var(--text-3)]">
                    No src = fallback
                  </span>
                </div>
              </div>
              <p className="text-xs text-[var(--text-3)] italic">
                Pass a local .riv asset via the src prop to render a Rive
                animation. Without src, the emerald spinner fallback shows.
              </p>
            </div>
          </GlassCard>

          {/* BrandDrawer */}
          <GlassCard
            variant="interactive"
            role="button"
            tabIndex={0}
            onClick={() => setDrawerOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setDrawerOpen(true);
              }
            }}
            aria-label="Open drawer demo"
          >
            <div className="space-y-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
                BrandDrawer (vaul)
              </p>
              <p className="text-sm text-[var(--text-2)]">
                Tap this card to open the mobile drawer. Handle visible, title,
                close button, escape-to-close.
              </p>
              <span className="inline-block text-xs text-[var(--brand-accent)]">
                Tap to open →
              </span>
            </div>
          </GlassCard>
        </div>

        <BrandDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          title="Submission details"
          description="Review the creator's submission before approving."
        >
          <div className="space-y-4 py-2">
            <div className="h-40 rounded-[var(--r3)] bg-[var(--surface-2)] flex items-center justify-center">
              <span className="text-sm text-[var(--text-3)]">
                Video preview placeholder
              </span>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-[var(--text-1)]">
                @creator_username
              </p>
              <p className="text-sm text-[var(--text-2)]">
                Submitted 2 hours ago for &quot;Summer Vibes Campaign&quot;
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                className="flex-1 rounded-[var(--r2)] bg-[var(--brand-accent)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-600"
                onClick={() => {
                  setDrawerOpen(false);
                  toast.success('Submission approved');
                }}
              >
                Approve
              </button>
              <button
                type="button"
                className="flex-1 rounded-[var(--r2)] border border-[var(--border-1)] px-4 py-2.5 text-sm font-medium text-[var(--text-2)] transition-colors hover:border-[var(--border-2)] hover:text-[var(--text-1)]"
                onClick={() => setDrawerOpen(false)}
              >
                Reject
              </button>
            </div>
          </div>
        </BrandDrawer>
      </Section>
    </>
  );
}
