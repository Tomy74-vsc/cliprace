import { NextResponse } from 'next/server';
import { ingestBatchTask } from '@/trigger/ingest-batch.task';

export const maxDuration = 10;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const handle = await ingestBatchTask.trigger({
      platform: undefined,
      limit: 200,
    });

    return NextResponse.json({
      ok: true,
      triggerId: handle.id,
      message: 'Batch ingestion triggered',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Trigger error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

