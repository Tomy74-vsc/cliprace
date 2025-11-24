/*
Source: Page Discover — Phase 2 (SEO + filtres server-side)
*/
import { motion } from 'framer-motion';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { DiscoverPageClient } from '@/components/contest/discover-page-client';
import type { ContestCardData } from '@/components/contest/contest-card';
import type { Platform } from '@/lib/validators/platforms';

const PAGE_SIZE = 9;
const PLATFORM_VALUES: Platform[] = ['tiktok', 'instagram', 'youtube'];

interface DiscoverPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function DiscoverContestsPage({ searchParams }: DiscoverPageProps) {
  const search = typeof searchParams.search === 'string' ? searchParams.search.slice(0, 80) : '';
  const platformsParam = typeof searchParams.platforms === 'string' ? searchParams.platforms : '';
  const selectedPlatforms = platformsParam
    ? platformsParam
        .split(',')
        .map((p) => p.trim())
        .filter((p): p is Platform => PLATFORM_VALUES.includes(p as Platform))
    : [];
  const currentPageRaw = Number(searchParams.page);
  const page = Number.isFinite(currentPageRaw) && currentPageRaw > 0 ? Math.floor(currentPageRaw) : 1;

  const { contests, total } = await fetchContests({
    search,
    platforms: selectedPlatforms,
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <h1 className="display-2 mb-2 bg-gradient-to-r from-[#635BFF] to-[#7C3AED] bg-clip-text text-transparent">
          Découvrir les concours
        </h1>
        <p className="text-muted-foreground text-lg">
          Participez aux concours actifs et gagnez des récompenses
        </p>
      </motion.div>

      <DiscoverPageClient
        contests={contests}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        filters={{ search, platforms: selectedPlatforms }}
      />
    </main>
  );
}

async function fetchContests({
  search,
  platforms,
  page,
  pageSize,
}: {
  search: string;
  platforms: Platform[];
  page: number;
  pageSize: number;
}): Promise<{ contests: ContestCardData[]; total: number }> {
  const supabase = getSupabaseSSR();
  const now = new Date().toISOString();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('contests')
    .select(
      `
      id,
      title,
      slug,
      brief_md,
      cover_url,
      prize_pool_cents,
      currency,
      start_at,
      end_at,
      networks,
      status,
      brand:brand_id (
        display_name,
        avatar_url
      )
    `,
      { count: 'exact' }
    )
    .eq('status', 'active')
    .lte('start_at', now)
    .gte('end_at', now);

  if (search) {
    const sanitizedSearch = search.replace(/%/g, '');
    query = query.or(
      `title.ilike.%${sanitizedSearch}%,brief_md.ilike.%${sanitizedSearch}%`
    );
  }

  if (platforms.length > 0) {
    query = query.overlaps('networks', platforms);
  }

  const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to);

  if (error) {
    console.error('Error fetching contests:', error);
    return { contests: [], total: 0 };
  }

  const contests: ContestCardData[] =
    data?.map((contest) => ({
      id: contest.id,
      title: contest.title,
      slug: contest.slug,
      brief_md: contest.brief_md,
      cover_url: contest.cover_url,
      prize_pool_cents: contest.prize_pool_cents,
      currency: contest.currency || 'EUR',
      start_at: contest.start_at,
      end_at: contest.end_at,
      networks: contest.networks || [],
      status: contest.status as ContestCardData['status'],
      brand: contest.brand as ContestCardData['brand'],
    })) ?? [];

  return {
    contests,
    total: count || 0,
  };
}
