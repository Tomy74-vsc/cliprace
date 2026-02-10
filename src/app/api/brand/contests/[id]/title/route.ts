/*
 * GET /api/brand/contests/[id]/title
 * Returns contest title for breadcrumbs (brand must own the contest).
 */
import { NextResponse } from 'next/server';
import { getSupabaseSSR } from '@/lib/supabase/ssr';

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = await getSupabaseSSR();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const { data: contest, error } = await supabase
    .from('contests')
    .select('title')
    .eq('id', id)
    .eq('brand_id', user.id)
    .maybeSingle();

  if (error || !contest) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ title: contest.title ?? 'Concours' });
}
