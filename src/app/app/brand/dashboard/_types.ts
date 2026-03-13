export interface BrandDashboardStats {
  // KPI Hero
  totalViews: number;
  totalViewsDeltaPct: number | null; // vs last period (reserved for future use)

  // KPI Strip
  activeContests: number;
  totalBudgetCents: number;
  pendingSubmissions: number;
  approvedSubmissions: number;
  totalCreators: number;

  // Chart (last 30 days)
  viewsOverTime: { date: string; views: number; submissions: number }[];
}

export interface RecentContest {
  id: string;
  title: string;
  status: string;
  submissionCount: number;
  totalViews: number;
  endAt: string;
}

