import { runIngestion, type Platform } from '@/lib/ingestion/run-ingestion';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function normalizePlatform(value: string): Platform | null {
  const v = value.toLowerCase();
  if (v === 'youtube' || v === 'tiktok' || v === 'instagram') {
    return v;
  }
  return null;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;

  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const normalized = normalizePlatform(platform);
  if (!normalized) {
    return Response.json(
      { ok: false, error: 'Unsupported platform' },
      { status: 400 },
    );
  }

  try {
    const report = await runIngestion(normalized);
    return Response.json({ ok: true, report }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Erreur interne lors de l’ingestion';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

