import { NextRequest, NextResponse } from 'next/server';
import { dequeueNextJob } from '@/lib/ingestion/queue';
import { dispatchIngestion } from '@/lib/ingestion/dispatcher';

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { ok: false, message: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const job = await dequeueNextJob();

    if (!job) {
      return NextResponse.json({
        ok: true,
        message: 'no jobs queued',
        processed: 0,
      });
    }

    const result = await dispatchIngestion({
      submissionId: job.submissionId,
      platform: job.platform,
      videoUrl: job.videoUrl,
      existingJobId: job.id,
    });

    return NextResponse.json({
      ok: true,
      processed: 1,
      succeeded: result.ok ? 1 : 0,
      failed: result.ok ? 0 : 1,
      result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal error';
    console.error('[cron:refresh-metrics] unexpected error', { message });
    return NextResponse.json(
      { ok: false, message: 'Internal server error' },
      { status: 500 },
    );
  }
}

