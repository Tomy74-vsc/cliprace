/*
Page: Edit contest draft (loads contest data, renders wizard in edit mode)
Only allows editing contests in "draft" status.
*/
import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { ContestWizardLoader } from '@/components/brand/wizard/ContestWizardLoader';

export default async function EditContestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = await getSession();
  if (!user) redirect('/auth/login');

  const { id } = await params;

  const admin = getSupabaseAdmin();

  // Fetch contest with all related data
  const { data: contest, error } = await admin
    .from('contests')
    .select(
      `
      id,
      title,
      brief_md,
      cover_url,
      status,
      prize_pool_cents,
      currency,
      start_at,
      end_at,
      networks,
      brand_id,
      contest_type,
      product_details,
      shipping_info,
      platform_fee,
      contest_terms_id,
      contest_terms:contest_terms_id (
        id,
        version,
        terms_markdown,
        terms_url
      ),
      contest_assets (
        id,
        url,
        type
      ),
      contest_prizes (
        id,
        position,
        amount_cents,
        percentage
      )
    `
    )
    .eq('id', id)
    .single();

  if (error || !contest) notFound();

  // Ownership check
  if (contest.brand_id !== user.id) notFound();

  // Only drafts can be edited
  if (contest.status !== 'draft') {
    redirect(`/app/brand/contests/${id}`);
  }

  // Format for the wizard loader
  const contestTerms = Array.isArray(contest.contest_terms)
    ? (contest.contest_terms as Array<{ version: string | null; terms_markdown: string | null; terms_url: string | null }>)[0] ?? null
    : (contest.contest_terms as { version: string | null; terms_markdown: string | null; terms_url: string | null } | null) ?? null;

  const contestData = {
    id: contest.id,
    title: contest.title,
    brief_md: contest.brief_md,
    cover_url: contest.cover_url,
    status: contest.status,
    prize_pool_cents: contest.prize_pool_cents,
    currency: contest.currency,
    start_at: contest.start_at,
    end_at: contest.end_at,
    networks: (contest.networks || []) as string[],
    brand_id: contest.brand_id,
    contest_type: (contest as Record<string, unknown>).contest_type as string | undefined,
    product_details: (contest as Record<string, unknown>).product_details as {
      name: string;
      value: number;
      image_url: string;
      brand_url?: string;
    } | null | undefined,
    shipping_info: (contest as Record<string, unknown>).shipping_info as {
      shipping_type: string;
      regions: string[];
    } | null | undefined,
    platform_fee: (contest as Record<string, unknown>).platform_fee as number | undefined,
    contest_terms: contestTerms
      ? {
          version: contestTerms.version,
          terms_markdown: contestTerms.terms_markdown,
          terms_url: contestTerms.terms_url,
        }
      : null,
    assets: ((contest.contest_assets || []) as Array<{ url: string; type: string }>).map((a) => ({
      url: a.url,
      type: a.type,
    })),
    prizes: ((contest.contest_prizes || []) as Array<{
      position: number;
      amount_cents: number | null;
      percentage: number | null;
    }>)
      .sort((a, b) => a.position - b.position)
      .map((p) => ({
        position: p.position,
        amount_cents: p.amount_cents,
        percentage: p.percentage,
      })),
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="animate-pulse text-muted-foreground">Chargement...</div>
          </div>
        }
      >
        <ContestWizardLoader contestData={contestData} mode="edit" />
      </Suspense>
    </main>
  );
}
