import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAnyPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { enforceAdminRateLimit } from '@/lib/admin/rate-limit';
import { adminCache, cacheKey, CACHE_TTL } from '@/lib/admin/cache';
import { formatErrorResponse } from '@/lib/errors';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireAdminAnyPermission([
      'users.read',
      'brands.read',
      'contests.read',
      'submissions.read',
      'finance.read',
      'integrations.read',
      'support.read',
    ]);

    await enforceAdminRateLimit(req, { route: 'admin:search', max: 60, windowMs: 60_000 }, user.id);

    const searchParams = req.nextUrl.searchParams;
    const q = searchParams.get('q') || '';
    const typesParam = searchParams.get('types') || 'users,orgs,contests,submissions,cashouts,webhooks,tickets';
    const types = typesParam.split(',').filter(Boolean);

    if (q.length < 2) {
      return NextResponse.json({ ok: true, groups: [] });
    }

    const term = q.trim();
    const key = cacheKey('admin:search', { user_id: user.id, q: term, types: types.join(',') });
    const groups = await adminCache.getOrSet(
      key,
      async () => {
        const admin = getAdminClient();
        const like = `%${term}%`;
        const termIsUuid = uuidPattern.test(term);

        const out: Array<{ type: string; items: Array<{ id: string; label: string; subtitle?: string; href: string }> }> = [];

        // Users
        if (types.includes('users')) {
          let usersQuery = admin.from('profiles').select('id, display_name, email, role').limit(5);
          usersQuery = termIsUuid ? usersQuery.eq('id', term) : usersQuery.or(`display_name.ilike.${like},email.ilike.${like}`);
          const { data: users } = await usersQuery;
          if (users && users.length > 0) {
            out.push({
              type: 'users',
              items: users.map((u) => ({
                id: u.id,
                label: u.display_name || u.email || u.id,
                subtitle: u.email || u.role,
                href: `/app/admin/users/${u.id}`,
              })),
            });
          }
        }

        // Orgs
        if (types.includes('orgs')) {
          let orgsQuery = admin.from('orgs').select('id, name, email').limit(5);
          orgsQuery = termIsUuid ? orgsQuery.eq('id', term) : orgsQuery.or(`name.ilike.${like},email.ilike.${like}`);
          const { data: orgs } = await orgsQuery;
          if (orgs && orgs.length > 0) {
            out.push({
              type: 'orgs',
              items: orgs.map((o) => ({
                id: o.id,
                label: o.name || o.email || o.id,
                subtitle: o.email,
                href: `/app/admin/brands?org_id=${o.id}`,
              })),
            });
          }
        }

        // Contests
        if (types.includes('contests')) {
          let contestsQuery = admin.from('contests').select('id, title, slug, status').limit(5);
          contestsQuery = termIsUuid ? contestsQuery.eq('id', term) : contestsQuery.or(`title.ilike.${like},slug.ilike.${like}`);
          const { data: contests } = await contestsQuery;
          if (contests && contests.length > 0) {
            out.push({
              type: 'contests',
              items: contests.map((c) => ({
                id: c.id,
                label: c.title || c.slug || c.id,
                subtitle: c.status,
                href: `/app/admin/contests/${c.id}`,
              })),
            });
          }
        }

        // Submissions
        if (types.includes('submissions')) {
          let submissionsQuery = admin.from('submissions').select('id, title, status, contest:contests(title)').limit(5);
          submissionsQuery = termIsUuid
            ? submissionsQuery.eq('id', term)
            : submissionsQuery.or(`title.ilike.${like},external_url.ilike.${like}`);
          const { data: submissions } = await submissionsQuery;
          if (submissions && submissions.length > 0) {
            out.push({
              type: 'submissions',
              items: submissions.map((s) => {
                const contest = Array.isArray(s.contest) ? s.contest[0] : s.contest;
                return {
                  id: s.id,
                  label: s.title || s.id,
                  subtitle: contest && 'title' in contest ? String(contest.title) : s.status,
                  href: `/app/admin/submissions?submission_id=${s.id}`,
                };
              }),
            });
          }
        }

        // Cashouts
        if (types.includes('cashouts')) {
          let cashoutsQuery = admin
            .from('cashouts')
            .select('id, amount_cents, status, creator:profiles(display_name, email)')
            .limit(5);
          cashoutsQuery = cashoutsQuery.eq('id', term);
          const { data: cashouts } = await cashoutsQuery;
          if (cashouts && cashouts.length > 0) {
            out.push({
              type: 'cashouts',
              items: cashouts.map((c) => {
                const creator = Array.isArray(c.creator) ? c.creator[0] : c.creator;
                return {
                  id: c.id,
                  label: `Cashout ${(c.amount_cents as number) / 100}€`,
                  subtitle: creator && 'display_name' in creator ? String(creator.display_name || creator.email) : c.status,
                  href: `/app/admin/finance?cashout_id=${c.id}`,
                };
              }),
            });
          }
        }

        // Webhooks
        if (types.includes('webhooks')) {
          let webhooksQuery = admin.from('webhooks_stripe').select('id, event_type, status, created_at').limit(5);
          webhooksQuery = termIsUuid ? webhooksQuery.eq('id', term) : webhooksQuery.ilike('event_type', like);
          const { data: webhooks } = await webhooksQuery;
          if (webhooks && webhooks.length > 0) {
            out.push({
              type: 'webhooks',
              items: webhooks.map((w) => ({
                id: w.id,
                label: w.event_type || w.id,
                subtitle: w.status,
                href: `/app/admin/integrations?webhook_id=${w.id}`,
              })),
            });
          }
        }

        // Tickets
        if (types.includes('tickets')) {
          let ticketsQuery = admin.from('support_tickets').select('id, subject, status, priority').limit(5);
          ticketsQuery = termIsUuid ? ticketsQuery.eq('id', term) : ticketsQuery.ilike('subject', like);
          const { data: tickets } = await ticketsQuery;
          if (tickets && tickets.length > 0) {
            out.push({
              type: 'tickets',
              items: tickets.map((t) => ({
                id: t.id,
                label: t.subject || t.id,
                subtitle: `${t.status} • ${t.priority}`,
                href: `/app/admin/support?ticket_id=${t.id}`,
              })),
            });
          }
        }

        return out;
      },
      CACHE_TTL.SHORT
    );

    return NextResponse.json({ ok: true, groups });
  } catch (error) {
    return formatErrorResponse(error);
  }
}
