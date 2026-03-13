/**
 * Business validators for the brand interface.
 * These are pure, synchronous guards — no DB round-trips.
 * They complement RLS (which enforces ownership) by validating state transitions.
 */

// ─── Minimal row shapes (subset of DB columns needed for validation) ──────────

export interface ContestRow {
  status: 'draft' | 'active' | 'paused' | 'ended' | 'archived';
  budget_cents: number;
}

export interface SubmissionRow {
  status: 'pending' | 'approved' | 'rejected';
}

// ─── Contest validators ───────────────────────────────────────────────────────

export const contestValidators = {
  /** A contest can be published only when it's a draft with a positive budget. */
  canPublish: (contest: ContestRow): boolean =>
    contest.status === 'draft' && contest.budget_cents > 0,

  /** Only active contests can be paused. */
  canPause: (contest: ContestRow): boolean =>
    contest.status === 'active',

  /** Only paused contests can be resumed. */
  canResume: (contest: ContestRow): boolean =>
    contest.status === 'paused',

  /** Active or paused contests can be ended. */
  canEnd: (contest: ContestRow): boolean =>
    (['active', 'paused'] as ContestRow['status'][]).includes(contest.status),

  /** Any non-deleted contest can be duplicated. */
  canDuplicate: (contest: ContestRow): boolean =>
    (['draft', 'active', 'ended', 'archived'] as ContestRow['status'][]).includes(contest.status),

  /** Only draft or paused contests can be edited. */
  canEdit: (contest: ContestRow): boolean =>
    (['draft', 'paused'] as ContestRow['status'][]).includes(contest.status),
};

// ─── Submission validators ────────────────────────────────────────────────────

export const submissionValidators = {
  /** Only pending submissions can be approved. */
  canApprove: (sub: SubmissionRow): boolean =>
    sub.status === 'pending',

  /** Only pending submissions can be rejected. */
  canReject: (sub: SubmissionRow): boolean =>
    sub.status === 'pending',
};

// ─── Message validators ───────────────────────────────────────────────────────

export const messageValidators = {
  /** A brand can only create threads on contests they own. */
  canCreateThread: (brandId: string, contestBrandId: string): boolean =>
    brandId === contestBrandId,
};
