import { getSupabaseAdmin } from '@/lib/supabase/server';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const threshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const { data, error } = await admin
      .from('contests')
      .update({
        status: 'archived',
        updated_at: new Date().toISOString(),
      })
      .eq('status', 'ended')
      .lt('end_at', threshold)
      .select('id');

    if (error) {
      throw error;
    }

    const archived = Array.isArray(data) ? data.length : 0;

    return Response.json({ ok: true, archived }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erreur interne lors de l’archivage des concours';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

