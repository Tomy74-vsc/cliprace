'use client';

import { useEffect, useState } from 'react';
import { useContestWizard, type ContestWizardData } from '@/store/useContestWizard';
import { ContestWizard } from './ContestWizard';

type ServerContestData = {
  id: string;
  title: string;
  brief_md: string | null;
  cover_url: string | null;
  status: string;
  prize_pool_cents: number;
  currency: string;
  start_at: string;
  end_at: string;
  networks: string[];
  brand_id: string;
  contest_type?: string;
  product_details?: {
    name: string;
    value: number;
    image_url: string;
    brand_url?: string;
  } | null;
  shipping_info?: {
    shipping_type: string;
    regions: string[];
  } | null;
  platform_fee?: number;
  contest_terms: {
    version: string | null;
    terms_markdown: string | null;
    terms_url: string | null;
  } | null;
  assets: Array<{ url: string; type: string }>;
  prizes: Array<{ position: number; amount_cents: number | null; percentage: number | null }>;
};

/**
 * Transforms server contest data into the wizard store format.
 */
function mapContestToWizardData(contest: ServerContestData): Partial<ContestWizardData> {
  const platforms = (contest.networks || []).filter(
    (n): n is 'tiktok' | 'instagram' | 'youtube' => ['tiktok', 'instagram', 'youtube'].includes(n)
  );

  return {
    contest_type: (contest.contest_type as 'cash' | 'product') || 'cash',
    product_details: contest.product_details
      ? {
          name: contest.product_details.name,
          value: contest.product_details.value,
          image_url: contest.product_details.image_url,
          brand_url: contest.product_details.brand_url,
        }
      : undefined,
    title: contest.title || '',
    description: contest.brief_md || '',
    prize_amount: contest.prize_pool_cents || undefined,
    shipping_info: contest.shipping_info
      ? {
          shipping_type: 'brand_managed' as const,
          regions: contest.shipping_info.regions || [],
        }
      : undefined,
    start_at: contest.start_at,
    end_at: contest.end_at,
    platforms: platforms.length > 0 ? platforms : ['tiktok'],
  };
}

/**
 * Loads contest data into the wizard store on mount, then renders the wizard.
 * Used for both "edit" and "duplicate" flows.
 */
export function ContestWizardLoader({
  contestData,
  mode,
}: {
  contestData: ServerContestData;
  /** 'edit' keeps the contest ID (Step5 calls update); 'duplicate' sets null (Step5 creates new) */
  mode: 'edit' | 'duplicate';
}) {
  const loadContest = useContestWizard((s) => s.loadContest);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const wizardData = mapContestToWizardData(contestData);
    const contestId = mode === 'edit' ? contestData.id : null;

    // For duplicates, prefix the title
    if (mode === 'duplicate') {
      wizardData.title = `Copie de ${wizardData.title}`;
    }

    loadContest(contestId, wizardData);
    setReady(true);
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-pulse text-muted-foreground">Chargement du concours...</div>
      </div>
    );
  }

  return <ContestWizard />;
}
