export type ContestStatus = 'draft' | 'active' | 'paused' | 'ended' | 'archived';

export interface ContestListItem {
  id: string;
  title: string;
  status: ContestStatus;
  budgetCents: number;
  prizePoolCents: number;
  currency: string;
  submissionCount: number;
  approvedCount: number;
  totalViews: number;
  creatorCount: number;
  startAt: string;
  endAt: string;
  createdAt: string;
  networks: string[];
}

export interface ContestsFilters {
  search: string;
  status: ContestStatus | 'all';
  sortBy: 'created_at' | 'end_at' | 'total_views' | 'submission_count';
  sortDir: 'asc' | 'desc';
}

