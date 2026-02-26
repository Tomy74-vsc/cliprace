'use client';

import { ContestWizard } from '@/components/brand/wizard/ContestWizard';

export type ContestWizardPrize = {
  position?: number;
  rank_start: number;
  rank_end: number;
  amount_cents: number;
  percentage?: number;
  [key: string]: unknown;
};

export type ContestWizardData = {
  contest_id: string | null;
  title: string;
  brief_md: string;
  cover_url: string;
  start_at: string;
  end_at: string;
  marketing_objective: string;
  min_followers: number | null;
  min_views: number | null;
  required_hashtags: string[];
  networks: string[];
  prizes: ContestWizardPrize[];
  currency: string;
  budget_cents: number;
  prize_pool_cents: number;
  total_prize_pool_cents: number;
  platform_fee: number;
  contest_type: 'cash' | 'product';
  productName: string;
  productOneLiner: string;
  productCategory: string | null;
  productBenefits: string[];
  productTargetAudience: string[];
  productAssets: Array<{ url: string; type: 'image' | 'video' | 'pdf'; name?: string }>;
  [key: string]: UnsafeAny;
};

interface ContestWizardClientProps {
  brandId?: string;
  mode?: 'brand' | 'admin';
}

export function ContestWizardClient(_props: ContestWizardClientProps) {
  return <ContestWizard />;
}
