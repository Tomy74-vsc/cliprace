/**
 * Dashboard loading skeleton — "Mission Control" layout.
 * Matches final page structure to prevent CLS.
 * Uses brand Ink tokens (inherited from BrandShell in layout).
 *
 * The Hero skeleton uses a generic shape that works for both:
 *   - Onboarding variant (title + chips + 3 steps) — taller
 *   - Active campaign variant (status + title + KPI row + actions) — shorter
 * We use the taller onboarding shape to avoid content-push CLS for new users.
 * Returning users see a brief shrink, which is less jarring than a push-down.
 *
 * Structure: Header → 12-col grid (Main 8 + Side 4)
 *   Main: Hero (notched) → Analytics
 *   Side: Live Queue → Insights
 *
 * animate-pulse respects prefers-reduced-motion via Tailwind defaults.
 */

const skeletonBlock = 'bg-[var(--surface-2)] animate-pulse';
const cardBase = 'rounded-[var(--r3)] border border-[var(--border-1)] bg-[var(--surface-1)]/80 p-6';

export default function BrandDashboardLoading() {
  return (
    <div
      className="mx-auto max-w-7xl px-4 lg:px-6 py-6 space-y-6"
      aria-busy="true"
      aria-label="Chargement du dashboard"
    >
      {/* ── Header skeleton ── */}
      <div className="space-y-2">
        <div className={`h-7 w-48 rounded-lg ${skeletonBlock}`} />
        <div className={`h-4 w-56 rounded ${skeletonBlock}`} />
      </div>

      {/* ── Grid skeleton ── */}
      <div className="grid grid-cols-12 gap-6">

        {/* ──── Main (8 cols) ──── */}
        <div className="col-span-12 lg:col-span-8 space-y-6">

          {/* Hero skeleton (notched) — generic shape for both states */}
          <div className={`${cardBase} clip-notch space-y-5`}>
            {/* Row 1: Status badge + title (active) / Title + subtitle (onboarding) */}
            <div className="space-y-2">
              <div className={`h-5 w-16 rounded-full ${skeletonBlock}`} />
              <div className={`h-6 w-64 rounded-lg ${skeletonBlock}`} />
              <div className={`h-4 w-80 rounded ${skeletonBlock}`} />
            </div>

            {/* Row 2: KPI area / Trust chips + first step */}
            <div className="flex flex-col sm:flex-row sm:items-end gap-6">
              <div className="flex-1 space-y-2">
                <div className={`h-12 w-40 rounded-lg ${skeletonBlock}`} />
                <div className={`h-4 w-24 rounded ${skeletonBlock}`} />
              </div>
              <div className="flex gap-6 sm:gap-8">
                <div className="space-y-2">
                  <div className={`h-3 w-24 rounded ${skeletonBlock}`} />
                  <div className={`h-6 w-20 rounded ${skeletonBlock}`} />
                </div>
                <div className="space-y-2">
                  <div className={`h-3 w-16 rounded ${skeletonBlock}`} />
                  <div className={`h-6 w-16 rounded ${skeletonBlock}`} />
                </div>
              </div>
            </div>

            {/* Row 3: Action buttons */}
            <div className="flex gap-3 pt-1">
              <div className={`h-10 w-40 rounded-[var(--r2)] ${skeletonBlock}`} />
              <div className={`h-10 w-36 rounded-[var(--r2)] ${skeletonBlock}`} />
            </div>
          </div>

          {/* Analytics skeleton */}
          <div className={cardBase}>
            <div className="flex items-center justify-between mb-4">
              <div className={`h-5 w-32 rounded ${skeletonBlock}`} />
              <div className={`h-7 w-40 rounded-[var(--r2)] ${skeletonBlock}`} />
            </div>
            <div className={`h-48 rounded-[var(--r2)] ${skeletonBlock}`} />
          </div>
        </div>

        {/* ──── Side rail (4 cols) ──── */}
        <aside className="col-span-12 lg:col-span-4 space-y-6">

          {/* Live Queue skeleton */}
          <div className={`${cardBase} space-y-4`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`h-4 w-4 rounded ${skeletonBlock}`} />
                <div className={`h-3 w-16 rounded ${skeletonBlock}`} />
              </div>
              <div className={`h-5 w-20 rounded-[var(--r2)] ${skeletonBlock}`} />
            </div>
            <div className="space-y-2 py-2">
              <div className={`h-4 w-44 rounded ${skeletonBlock}`} />
              <div className="flex items-center gap-1.5">
                <div className={`h-1.5 w-1.5 rounded-full ${skeletonBlock}`} />
                <div className={`h-3 w-56 rounded ${skeletonBlock}`} />
              </div>
            </div>
          </div>

          {/* Insights skeleton */}
          <div className={`${cardBase} space-y-3`}>
            <div className={`h-3 w-16 rounded ${skeletonBlock} mb-4`} />
            {[...Array(4)].map((_, i) => (
              <div key={i}>
                <div className="flex items-center justify-between py-1">
                  <div className={`h-4 w-36 rounded ${skeletonBlock}`} />
                  <div className={`h-4 w-16 rounded ${skeletonBlock}`} />
                </div>
                {i === 2 && (
                  <div className={`mt-1.5 h-0.5 w-full rounded-full ${skeletonBlock}`} />
                )}
                {i < 3 && <div className="h-px bg-[var(--border-1)] mt-3" />}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
