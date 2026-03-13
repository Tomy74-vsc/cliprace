export type ContestStatus = 'draft' | 'active' | 'paused' | 'ended' | 'archived';

export interface ContestDetail {
  id: string;
  title: string;
  status: ContestStatus;
  briefMd: string | null;
  coverUrl: string | null;
  budgetCents: number;
  prizePoolCents: number;
  currency: string;
  startAt: string;
  endAt: string;
  networks: string[];
  maxWinners: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContestMetrics {
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalWeightedViews: number;
  totalSubmissions: number;
  approvedSubmissions: number;
  totalCreators: number;
  budgetSpentCents: number;
  budgetRemainingCents: number;
  cpv: number | null;
}

export interface SubmissionItem {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorAvatarUrl: string | null;
  status: 'pending' | 'approved' | 'rejected';
  videoUrl: string | null;
  thumbnailUrl: string | null;
  views: number;
  likes: number;
  platform: string;
  submittedAt: string;
  rejectionReason: string | null;
}

export interface LeaderboardEntry {
  rank: number;
  creatorId: string;
  creatorName: string;
  creatorAvatarUrl: string | null;
  totalWeightedViews: number;
  totalViews: number;
  totalLikes: number;
  submissionCount: number;
  estimatedPrizeCents: number;
}

