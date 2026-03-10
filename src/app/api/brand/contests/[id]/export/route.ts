import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getUserRole } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';
import { buildRateLimitKey } from '@/lib/safe-ip';

function sanitizeFileName(input: string): string {
  const normalized = input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return normalized || 'campagne';
}

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return '';
  const raw = String(value);
  const escaped = raw.replace(/"/g, '""');
  const needsQuotes = /[;"\r\n]/.test(raw);
  return needsQuotes ? `"${escaped}"` : escaped;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contestId } = await context.params;
    const supabase = await getSupabaseSSR();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }

    const role = await getUserRole(user.id);
    if (role !== 'brand' && role !== 'admin') {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    const rlKey = buildRateLimitKey(`brand:contest:export:${contestId}`, user.id, req);
    const allowed = await rateLimit({
      key: rlKey,
      route: 'brand:contest:export',
      windowMs: 60_000,
      max: 10,
    });
    if (!allowed) {
      return NextResponse.json({ ok: false, message: 'Rate limit exceeded' }, { status: 429 });
    }

    const isAdmin = role === 'admin';
    // Admin bypasses RLS via admin client; brand uses SSR client (RLS-aware)
    const queryClient = isAdmin ? getSupabaseAdmin() : supabase;

    const { data: contest, error: contestError } = await queryClient
      .from('contests')
      .select('id, title, brand_id')
      .eq('id', contestId)
      .single();
    if (contestError || !contest) {
      return NextResponse.json({ ok: false, message: 'Contest not found' }, { status: 404 });
    }
    // Ownership: brand must own the contest; admin can export any contest
    if (!isAdmin && contest.brand_id !== user.id) {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }

    const { data: approvedSubmissions, error: submissionsError } = await queryClient
      .from('submissions')
      .select('id, external_url, platform, approved_at, creator:creator_id(display_name)')
      .eq('contest_id', contestId)
      .eq('status', 'approved')
      .order('approved_at', { ascending: false });
    if (submissionsError) {
      console.error('contest_export:submissions_error', submissionsError);
      return NextResponse.json({ ok: false, message: 'Failed to load submissions' }, { status: 500 });
    }

    const submissionIds = (approvedSubmissions || []).map((s) => s.id);
    const metricsBySubmission = new Map<string, { views: number; likes: number }>();

    if (submissionIds.length > 0) {
      const { data: metricsRows, error: metricsError } = await queryClient
        .from('metrics_daily')
        .select('submission_id, views:sum(views), likes:sum(likes)')
        .in('submission_id', submissionIds);
      if (metricsError) {
        console.error('contest_export:metrics_error', metricsError);
        return NextResponse.json({ ok: false, message: 'Failed to load metrics' }, { status: 500 });
      }

      (metricsRows || []).forEach((row: UnsafeAny) => {
        const viewsValue = Array.isArray(row.views)
          ? Number((row.views[0] as UnsafeAny)?.views || 0)
          : Number(row.views || 0);
        const likesValue = Array.isArray(row.likes)
          ? Number((row.likes[0] as UnsafeAny)?.likes || 0)
          : Number(row.likes || 0);

        metricsBySubmission.set(String(row.submission_id), {
          views: viewsValue,
          likes: likesValue,
        });
      });
    }

    const headers = [
      'Nom createur',
      'URL video',
      'Vues',
      'Likes',
      'Date approbation',
      'Plateforme',
    ];

    const lines = [headers.map(escapeCsv).join(';')];
    (approvedSubmissions || []).forEach((submission) => {
      const metrics = metricsBySubmission.get(submission.id) || { views: 0, likes: 0 };
      const creatorName = (submission.creator as { display_name?: string | null } | null)?.display_name || 'Createur';
      const approvedAt = submission.approved_at || '';
      const row = [
        creatorName,
        submission.external_url,
        metrics.views,
        metrics.likes,
        approvedAt,
        submission.platform,
      ];
      lines.push(row.map(escapeCsv).join(';'));
    });

    const slug = sanitizeFileName(contest.title || `contest-${contestId.slice(0, 8)}`);
    const fileName = `campagne-${slug}-cliprace.csv`;
    const csv = `\uFEFF${lines.join('\n')}`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('contest_export:unexpected_error', error);
    return NextResponse.json({ ok: false, message: 'Server error' }, { status: 500 });
  }
}
