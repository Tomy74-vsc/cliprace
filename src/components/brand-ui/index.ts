/**
 * Brand UI Kit v1 — Barrel export.
 * Import from '@/components/brand-ui' for all brand-facing components.
 */

// ── Layout ──
export { BrandShell } from './BrandShell';
export type { BrandShellProps } from './BrandShell';

// ── Navigation ──
export { BrandRailNav } from './BrandRailNav';
export { BrandTopBar } from './BrandTopBar';
export type { BrandTopBarProps } from './BrandTopBar';
export { CampaignSelector } from './CampaignSelector';
export { BrandCommand } from './BrandCommand';
export type { BrandCommandProps } from './BrandCommand';

// ── Surfaces ──
export { Surface, surfaceVariants } from './Surface';
export type { SurfaceProps } from './Surface';
export { Panel } from './Panel';
export type { PanelProps } from './Panel';
export { Card } from './Card';
export type { CardProps } from './Card';
export { GlassCard } from './GlassCard';
export type { GlassCardProps } from './GlassCard';

// ── Data display ──
export { KpiHero } from './KpiHero';
export type { KpiHeroProps, KpiHeroFormat } from './KpiHero';
export { Kpi } from './Kpi';
export type { KpiProps, KpiTrend } from './Kpi';
export { DataTable } from './DataTable';
export type { DataTableProps } from './DataTable';

// ── Status ──
export { StatusBadge, statusBadgeVariants, contestStatusVariant, contestStatusLabel } from './StatusBadge';
export type { StatusBadgeProps, StatusKey } from './StatusBadge';

// ── Skeletons ──
export {
  SkeletonLine,
  SkeletonBlock,
  SkeletonKpiHero,
  SkeletonKpi,
  SkeletonCard,
  SkeletonTable,
  SkeletonBrandShell,
} from './Skeleton';
export type {
  SkeletonLineProps,
  SkeletonBlockProps,
  SkeletonCardProps,
  SkeletonTableProps,
} from './Skeleton';

// ── Feedback ──
export { EmptyState } from './EmptyState';
export type { EmptyStateProps, EmptyStateAction } from './EmptyState';
export { ErrorState } from './ErrorState';
export type { ErrorStateProps } from './ErrorState';
export { ActionDialog } from './ActionDialog';
export type { ActionDialogProps } from './ActionDialog';

// ── Forms ──
export { BrandInput } from './BrandInput';
export type { BrandInputProps } from './BrandInput';

// ── Mobile ──
export { BrandDrawer } from './BrandDrawer';
export type { BrandDrawerProps } from './BrandDrawer';

// ── Providers ──
export { BrandProviders } from './BrandProviders';
export type { BrandProvidersProps } from './BrandProviders';

// ── Hooks ──
export { useBrandPortalContainer, BRAND_PORTAL_ID } from './use-brand-portal';

// ── Micro-interactions ──
export { RiveLoader } from './RiveLoader';
export type { RiveLoaderProps } from './RiveLoader';
