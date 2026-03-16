/**
 * Brand UI Kit Demo — /brand/ui-kit
 * Static showcase of all brand-ui components.
 * Dev-only: NOT accessible in production builds.
 *
 * Sections:
 * 1. Typography
 * 2. Colors
 * 3. Surfaces (GlassCard variants)
 * 4. Inputs (BrandInput)
 * 5. KPIs (KpiHero)
 * 6. Feedback (sonner + ActionDialog)
 * 7. RiveLoader
 */
import { notFound } from 'next/navigation';
import { BrandShell } from '@/components/brand-ui/BrandShell';
import { GlassCard } from '@/components/brand-ui/GlassCard';
import { BrandInput } from '@/components/brand-ui/BrandInput';
import { Surface } from '@/components/brand-ui/Surface';
import { Panel } from '@/components/brand-ui/Panel';
import { Card } from '@/components/brand-ui/Card';
import { StatusBadge } from '@/components/brand-ui/StatusBadge';
import { EmptyState } from '@/components/brand-ui/EmptyState';
import {
  SkeletonKpiHero,
  SkeletonKpi,
  SkeletonCard,
  SkeletonTable,
} from '@/components/brand-ui/Skeleton';
import { DemoInteractive } from './demo-interactive';
import { Search, Mail, Lock, Inbox } from 'lucide-react';

/* Gate: design-system demo is dev-only */
const IS_DEV = process.env.NODE_ENV !== 'production';

/* ── Section wrapper ── */
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

/* ── Color swatch ── */
function Swatch({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="h-16 w-16 rounded-[var(--r2)] border border-[var(--border-1)]"
        style={{ background: value }}
        aria-label={`${name}: ${value}`}
      />
      <div className="text-center">
        <p className="text-xs font-medium text-[var(--text-1)]">{name}</p>
        <p className="text-[10px] text-[var(--text-3)] font-mono">{value}</p>
      </div>
    </div>
  );
}

export default function UiKitPage() {
  if (!IS_DEV) notFound();

  return (
    <BrandShell
      topbar={
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-[var(--text-1)] brand-tracking">
            ClipRace
          </span>
          <span className="text-xs text-[var(--text-3)]">Brand UI Kit v1</span>
        </div>
      }
    >
      <div className="space-y-16">
        {/* ── Header ── */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-[var(--text-1)] brand-tracking-tight">
            Brand UI Kit
          </h1>
          <p className="text-sm text-[var(--text-2)] max-w-lg">
            Design system foundation for ClipRace brand-facing pages.
            Tokens, surfaces, inputs, KPIs, feedback, and micro-interactions.
          </p>
        </div>

        {/* ══════════════════════════════════════════
            1. TYPOGRAPHY
            ══════════════════════════════════════════ */}
        <Section title="1. Typography">
          <GlassCard pattern="track">
            <div className="space-y-6">
              <div>
                <p className="text-xs text-[var(--text-3)] mb-1 uppercase tracking-wide">
                  Display KPI (48px, -0.03em)
                </p>
                <p className="text-5xl font-semibold brand-tracking-tight brand-tabular text-[var(--text-1)]">
                  12,847
                </p>
              </div>

              <div>
                <p className="text-xs text-[var(--text-3)] mb-1 uppercase tracking-wide">
                  H1 (26px, weight 600)
                </p>
                <h1 className="text-[26px] font-semibold brand-tracking text-[var(--text-1)]">
                  Dashboard Overview
                </h1>
              </div>

              <div>
                <p className="text-xs text-[var(--text-3)] mb-1 uppercase tracking-wide">
                  H2 (20px, weight 600)
                </p>
                <h2 className="text-xl font-semibold brand-tracking text-[var(--text-1)]">
                  Campaign Performance
                </h2>
              </div>

              <div>
                <p className="text-xs text-[var(--text-3)] mb-1 uppercase tracking-wide">
                  Body (14px, weight 400)
                </p>
                <p className="text-sm text-[var(--text-2)] leading-relaxed max-w-md">
                  Your campaign is performing well. Submissions are coming in
                  steadily and engagement metrics are above average for this
                  category.
                </p>
              </div>

              <div>
                <p className="text-xs text-[var(--text-3)] mb-1 uppercase tracking-wide">
                  Label (12px, uppercase, tracking-wide)
                </p>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-3)]">
                  Total prize pool
                </p>
              </div>

              <div>
                <p className="text-xs text-[var(--text-3)] mb-1 uppercase tracking-wide">
                  Tabular nums (aligned)
                </p>
                <div className="font-mono text-sm brand-tabular text-[var(--text-1)] space-y-0.5">
                  <p>1,234.56</p>
                  <p>12,345.00</p>
                  <p>123.99</p>
                </div>
              </div>
            </div>
          </GlassCard>
        </Section>

        {/* ══════════════════════════════════════════
            2. COLORS
            ══════════════════════════════════════════ */}
        <Section title="2. Colors">
          <GlassCard>
            <div className="space-y-8">
              {/* Backgrounds */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-3)] mb-3">
                  Background depth scale
                </p>
                <div className="flex flex-wrap gap-4">
                  <Swatch name="Void" value="#050505" />
                  <Swatch name="Ink" value="#07090B" />
                  <Swatch name="Surface 1" value="#0A0F14" />
                  <Swatch name="Surface 2" value="#101721" />
                  <Swatch name="Surface 3" value="#141C28" />
                </div>
              </div>

              {/* Text */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-3)] mb-3">
                  Text hierarchy
                </p>
                <div className="space-y-2">
                  <p className="text-sm text-[var(--text-1)]">
                    Text-1: Primary — rgba(255,255,255,0.92)
                  </p>
                  <p className="text-sm text-[var(--text-2)]">
                    Text-2: Secondary — rgba(255,255,255,0.66)
                  </p>
                  <p className="text-sm text-[var(--text-3)]">
                    Text-3: Tertiary — rgba(255,255,255,0.44)
                  </p>
                </div>
              </div>

              {/* Accent + Status */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-3)] mb-3">
                  Accent + Status
                </p>
                <div className="flex flex-wrap gap-4">
                  <Swatch name="Accent" value="#10B981" />
                  <Swatch name="Success" value="#10B981" />
                  <Swatch name="Warning" value="#F59E0B" />
                  <Swatch name="Danger" value="#EF4444" />
                  <Swatch name="CTA bg" value="#FFFFFF" />
                </div>
              </div>
            </div>
          </GlassCard>
        </Section>

        {/* ══════════════════════════════════════════
            3. SURFACES (GlassCard)
            ══════════════════════════════════════════ */}
        <Section title="3. Surfaces">
          <div className="grid gap-6 sm:grid-cols-2">
            <GlassCard>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-3)] mb-2">
                Default
              </p>
              <p className="text-sm text-[var(--text-2)]">
                Base glass surface with subtle border and backdrop blur.
              </p>
            </GlassCard>

            <GlassCard variant="interactive">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-3)] mb-2">
                Interactive
              </p>
              <p className="text-sm text-[var(--text-2)]">
                Hover to see lift + border brightening. Cursor pointer.
              </p>
            </GlassCard>

            <GlassCard notched>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-3)] mb-2">
                Notched (Clip Notch)
              </p>
              <p className="text-sm text-[var(--text-2)]">
                Cut corner on top-right. Used on premium surfaces.
              </p>
            </GlassCard>

            <GlassCard pattern="track">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-3)] mb-2">
                Track Pattern
              </p>
              <p className="text-sm text-[var(--text-2)]">
                Subtle grid texture at 3% opacity. Used on select panels.
              </p>
            </GlassCard>

            {/* Beam — full width, the "wow" for this section */}
            <div className="sm:col-span-2">
              <GlassCard effect="beam" notched>
                <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-3)] mb-2">
                  Beam + Notched (Magic UI inspired)
                </p>
                <p className="text-sm text-[var(--text-2)] max-w-md">
                  Emerald border beam sweeps around the card edge. CSS-only,
                  GPU-accelerated. Max 1 per screen in production.
                </p>
              </GlassCard>
            </div>
          </div>
        </Section>

        {/* ══════════════════════════════════════════
            4. INPUTS
            ══════════════════════════════════════════ */}
        <Section title="4. Inputs">
          <GlassCard>
            <div className="grid gap-6 sm:grid-cols-2 max-w-2xl">
              <BrandInput
                label="Campaign name"
                placeholder="My awesome campaign"
                helpText="Choose a clear, descriptive name."
              />
              <BrandInput
                label="Budget"
                type="number"
                placeholder="5000"
                endAdornment="EUR"
              />
              <BrandInput
                label="Search"
                placeholder="Search campaigns..."
                startIcon={Search}
              />
              <BrandInput
                label="Email"
                type="email"
                placeholder="hello@brand.com"
                startIcon={Mail}
                error="This email is already registered."
              />
              <BrandInput
                label="Password"
                type="password"
                placeholder="Enter password"
                startIcon={Lock}
              />
              <BrandInput
                label="Commission"
                type="number"
                placeholder="15"
                endAdornment="%"
                helpText="Platform commission rate."
              />
              <BrandInput
                label="Disabled"
                placeholder="Cannot edit"
                disabled
                helpText="This field is locked."
              />
            </div>
          </GlassCard>
        </Section>

        {/* ══════════════════════════════════════════
            3b. NEW SURFACES (Surface, Panel, Card)
            ══════════════════════════════════════════ */}
        <Section title="3b. Surface / Panel / Card">
          <div className="grid gap-6 sm:grid-cols-2">
            <Surface variant="default" className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-3)] mb-2">Surface — default</p>
              <p className="text-sm text-[var(--text-2)]">Base surface with border and shadow.</p>
            </Surface>
            <Surface variant="hoverable" className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-3)] mb-2">Surface — hoverable</p>
              <p className="text-sm text-[var(--text-2)]">Hover to see lift effect.</p>
            </Surface>
            <Surface variant="track" className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-3)] mb-2">Surface — track</p>
              <p className="text-sm text-[var(--text-2)]">SVG track pattern background.</p>
            </Surface>
            <Surface variant="notched" className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-3)] mb-2">Surface — notched</p>
              <p className="text-sm text-[var(--text-2)]">Clip Notch cut corner.</p>
            </Surface>
          </div>

          <Panel title="Panel with header" description="A panel with title, description, and action slot." action={<span className="text-xs text-[var(--brand-accent)]">Action →</span>}>
            <p className="text-sm text-[var(--text-2)]">Panel body content with p-6 padding.</p>
          </Panel>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <p className="text-sm text-[var(--text-2)]">Basic card</p>
            </Card>
            <Card variant="hoverable">
              <p className="text-sm text-[var(--text-2)]">Hoverable card</p>
            </Card>
            <Card>
              <p className="text-sm text-[var(--text-2)]">Another card</p>
            </Card>
          </div>
        </Section>

        {/* ══════════════════════════════════════════
            3c. STATUS BADGES
            ══════════════════════════════════════════ */}
        <Section title="3c. Status Badges">
          <GlassCard>
            <div className="flex flex-wrap gap-3">
              <StatusBadge status="active" />
              <StatusBadge status="draft" />
              <StatusBadge status="paused" />
              <StatusBadge status="ended" />
              <StatusBadge status="archived" />
              <StatusBadge status="pending" />
              <StatusBadge status="approved" />
              <StatusBadge status="rejected" />
              <StatusBadge status="live" />
              <StatusBadge variant="success" label="Custom label" />
            </div>
          </GlassCard>
        </Section>

        {/* ══════════════════════════════════════════
            3d. SKELETONS
            ══════════════════════════════════════════ */}
        <Section title="3d. Skeletons">
          <div className="grid gap-6 sm:grid-cols-3">
            <SkeletonKpiHero />
            <SkeletonKpiHero />
            <SkeletonKpiHero />
          </div>
          <div className="grid gap-4 sm:grid-cols-4 mt-4">
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 mt-4">
            <SkeletonCard lines={3} />
            <SkeletonCard lines={4} />
          </div>
          <SkeletonTable rows={3} cols={4} className="mt-4" />
        </Section>

        {/* ══════════════════════════════════════════
            3e. EMPTY + ERROR STATES
            ══════════════════════════════════════════ */}
        <Section title="3e. Empty & Error States">
          <div className="grid gap-6 sm:grid-cols-2">
            <Surface className="overflow-hidden">
              <EmptyState
                title="No campaigns yet"
                description="Create your first campaign to get started."
                icon={<Inbox />}
              />
            </Surface>
            <Surface className="overflow-hidden">
              <EmptyState
                title="No submissions"
                description="Creators haven't submitted content yet."
                variant="track"
              />
            </Surface>
          </div>
        </Section>

        {/* ══════════════════════════════════════════
            5–7. INTERACTIVE SECTIONS (Client)
            ══════════════════════════════════════════ */}
        <DemoInteractive />
      </div>
    </BrandShell>
  );
}
