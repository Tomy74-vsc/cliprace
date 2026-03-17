/*
Source: Page Discover - Netflix-style hero, category pills, glass cards.
*/
import Link from "next/link";
import { getSupabaseSSR } from "@/lib/supabase/ssr";
import { DiscoverNetflixClient } from "@/components/contest/discover-netflix-client";
import type { ContestCardData } from "@/components/contest/contest-card";
import type { Platform } from "@/lib/validators/platforms";
import { TrackOnView } from "@/components/analytics/track-once";
import { Button } from "@/components/ui/button";
import { CreatorCoach } from "@/components/creator/creator-coach";
import { Sparkles } from "lucide-react";

const PAGE_SIZE = 40;
const PLATFORM_VALUES: Platform[] = ["tiktok", "instagram", "youtube"];
const STATUS_VALUES = ["active", "upcoming", "ended"] as const;
const SORT_VALUES = ["ending_soon", "prize_desc", "newest"] as const;

export const revalidate = 60;

interface DiscoverPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DiscoverContestsPage({ searchParams }: DiscoverPageProps) {
  const params = await searchParams;

  const search = typeof params.search === "string" ? params.search.slice(0, 80) : "";
  const platformsParam = typeof params.platforms === "string" ? params.platforms : "";
  const selectedPlatforms = platformsParam
    ? platformsParam
        .split(",")
        .map((p) => p.trim())
        .filter((p): p is Platform => PLATFORM_VALUES.includes(p as Platform))
    : [];
  const currentPageRaw = Number(params.page);
  const page = Number.isFinite(currentPageRaw) && currentPageRaw > 0 ? Math.floor(currentPageRaw) : 1;

  const rawStatus = typeof params.status === "string" ? params.status : null;
  const statusParam: (typeof STATUS_VALUES)[number] = STATUS_VALUES.includes(rawStatus as (typeof STATUS_VALUES)[number])
    ? (rawStatus as (typeof STATUS_VALUES)[number])
    : "active";

  const rawSort = typeof params.sort === "string" ? params.sort : null;
  const sortParam: (typeof SORT_VALUES)[number] = SORT_VALUES.includes(rawSort as (typeof SORT_VALUES)[number])
    ? (rawSort as (typeof SORT_VALUES)[number])
    : "prize_desc";

  const { contests, total, profileIncomplete: _profileIncomplete } = await fetchContests({
    search,
    platforms: selectedPlatforms,
    status: statusParam,
    sort: sortParam,
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 space-y-8">
      <TrackOnView
        event="view_contests_discover"
        payload={{
          total,
          page,
          status: statusParam,
          sort: sortParam,
          has_search: Boolean(search),
          platforms: selectedPlatforms,
        }}
      />
      <div className="rounded-3xl border border-border bg-card/60 p-5 sm:p-6 shadow-card space-y-4 cliprace-surface">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Concours créateurs</p>
            <h1 className="text-2xl sm:text-3xl font-semibold leading-tight">Découvre les concours actifs</h1>
            <p className="text-muted-foreground text-base max-w-2xl">
              Choisis un brief, filme ta vidéo et dépose ta participation pour tenter de gagner.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="w-full sm:w-auto">
              <a href="#liste-concours">Voir les concours disponibles</a>
            </Button>
            <Button asChild variant="secondary" className="w-full sm:w-auto">
              <Link href="/app/creator/submissions">Mes soumissions</Link>
            </Button>
          </div>
        </div>
        <CreatorCoach
          accent="Astuce Discover"
          title="Choisis le bon concours pour toi"
          description={
            total > 0
              ? "Commence par un concours adapté à ta plateforme principale et qui se termine bientôt."
              : "Aucun concours avec ces filtres. Essaie une autre plateforme ou des filtres plus larges."
          }
          icon={<Sparkles className="h-4 w-4" />}
        />
      </div>

      <section id="liste-concours" className="space-y-6">
        <DiscoverNetflixClient contests={contests} />
      </section>
    </main>
  );
}

async function fetchContests({
  search,
  platforms,
  status,
  sort,
  page,
  pageSize,
}: {
  search: string;
  platforms: Platform[];
  status: "active" | "upcoming" | "ended";
  sort: "ending_soon" | "prize_desc" | "newest";
  page: number;
  pageSize: number;
}): Promise<{
  contests: ContestCardData[];
  total: number;
  profileIncomplete: boolean;
}> {
  const supabase = await getSupabaseSSR();
  const now = new Date().toISOString();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: profile } = await supabase.from("profile_creators").select("primary_platform, followers, avg_views").maybeSingle();

  let query = supabase
    .from("contests")
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
      min_followers,
      min_views,
      brand:brand_id (
        display_name,
        avatar_url
      )
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (status === "active") {
    query = query.eq("status", "active").lte("start_at", now).gte("end_at", now);
  } else if (status === "upcoming") {
    query = query.eq("status", "active").gt("start_at", now);
  } else if (status === "ended") {
    query = query.in("status", ["ended", "archived"]).lt("end_at", now);
  }

  if (search) {
    const sanitizedSearch = search.replace(/%/g, "");
    query = query.or(`title.ilike.%${sanitizedSearch}%,brief_md.ilike.%${sanitizedSearch}%`);
  }

  if (platforms.length > 0) {
    query = query.overlaps("networks", platforms);
  }

  if (sort === "ending_soon") {
    query = query.order("end_at", { ascending: true });
  } else if (sort === "prize_desc") {
    query = query.order("prize_pool_cents", { ascending: false });
  } else if (sort === "newest") {
    query = query.order("created_at", { ascending: false });
  }

  const { data, count, error } = await query.range(from, to);

  if (error) {
    console.error("Error fetching contests:", error);
    return { contests: [], total: 0, profileIncomplete: false };
  }

  const contests: ContestCardData[] =
    data?.map((contest) => {
      const eligibility = computeEligibility({
        contest,
        primaryPlatform: profile?.primary_platform ?? null,
        followers: null,
        avgViews: null,
      });
      return {
        id: contest.id,
        title: contest.title,
        slug: contest.slug,
        brief_md: contest.brief_md,
        cover_url: contest.cover_url,
        prize_pool_cents: contest.prize_pool_cents,
        currency: contest.currency || "EUR",
        start_at: contest.start_at,
        end_at: contest.end_at,
        networks: contest.networks || [],
        status: contest.status as ContestCardData["status"],
        min_followers: (contest as { min_followers?: number | null }).min_followers ?? undefined,
        min_views: (contest as { min_views?: number | null }).min_views ?? undefined,
        eligibility,
        brand: contest.brand as ContestCardData["brand"],
      };
    }) ?? [];

  return {
    contests,
    total: count || 0,
    profileIncomplete: !profile?.primary_platform,
  };
}

function computeEligibility({
  contest,
  primaryPlatform,
  followers,
  avgViews,
}: {
  contest: {
    networks: Platform[];
    min_followers?: number | null;
    min_views?: number | null;
  };
  primaryPlatform: string | null;
  followers: number | null;
  avgViews: number | null;
}) {
  const reasons: string[] = [];
  const platformOk =
    !primaryPlatform || contest.networks.length === 0 || contest.networks.includes(primaryPlatform as Platform);
  if (!platformOk) reasons.push("Plateforme différente");
  void followers;
  void avgViews;
  return {
    ok: reasons.length === 0,
    reasons,
  };
}
