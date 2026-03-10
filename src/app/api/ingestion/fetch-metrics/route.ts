import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { dispatchIngestion } from '@/lib/ingestion/dispatcher';
import type { IngestionResult, IngestionPlatform } from '@/lib/ingestion/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BodySchema = z.object({
  submission_ids: z.array(z.string().uuid()).min(1).max(50),
});

type DbSubmissionRow = {
  id: string;
  platform: IngestionPlatform | string;
  external_url: string;
  status: string;
};

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { ok: false, message: 'Unauthorized' },
      { status: 401 },
    );
  }

  let parsedBody: z.infer<typeof BodySchema>;
  try {
    const json = await req.json();
    parsedBody = BodySchema.parse(json);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Invalid request body';
    return NextResponse.json(
      { ok: false, message: `Invalid body: ${message}` },
      { status: 400 },
    );
  }

  try {
    const admin = getSupabaseAdmin();
    const { submission_ids } = parsedBody;

    const { data: submissions, error: submissionsError } = await admin
      .from('submissions')
      .select('id, platform, external_url, status')
      .in('id', submission_ids);

    if (submissionsError) {
      return NextResponse.json(
        {
          ok: false,
          message:
            submissionsError.message ??
            'Failed to load submissions for ingestion',
        },
        { status: 500 },
      );
    }

    const submissionById = new Map<string, DbSubmissionRow>();
    for (const row of submissions ?? []) {
      submissionById.set(row.id, row as DbSubmissionRow);
    }

    const contexts = submission_ids.map((id) => {
      const row = submissionById.get(id);
      return { id, row };
    });

    const dispatchPromises: Array<Promise<IngestionResult | null>> = [];
    const precomputedResults: Array<IngestionResult | null> = [];

    for (const ctx of contexts) {
      const row = ctx.row;

      if (!row) {
        precomputedResults.push({
          ok: false,
          submissionId: ctx.id,
          platform: 'youtube',
          error: 'SUBMISSION_NOT_FOUND',
          errorCode: 'SUBMISSION_NOT_FOUND',
        });
        dispatchPromises.push(Promise.resolve(null));
        continue;
      }

      const platform = row.platform.toLowerCase() as
        | IngestionPlatform
        | string;

      if (row.status !== 'approved') {
        precomputedResults.push({
          ok: false,
          submissionId: ctx.id,
          platform:
            platform === 'youtube' ||
            platform === 'tiktok' ||
            platform === 'instagram'
              ? (platform as IngestionPlatform)
              : 'youtube',
          error: 'SUBMISSION_NOT_APPROVED',
          errorCode: 'SUBMISSION_NOT_APPROVED',
        });
        dispatchPromises.push(Promise.resolve(null));
        continue;
      }

      if (platform !== 'youtube') {
        precomputedResults.push({
          ok: false,
          submissionId: ctx.id,
          platform:
            platform === 'youtube' ||
            platform === 'tiktok' ||
            platform === 'instagram'
              ? (platform as IngestionPlatform)
              : 'youtube',
          error: 'PLATFORM_NOT_SUPPORTED',
          errorCode: 'PLATFORM_NOT_SUPPORTED',
        });
        dispatchPromises.push(Promise.resolve(null));
        continue;
      }

      precomputedResults.push(null);
      dispatchPromises.push(
        dispatchIngestion({
          submissionId: ctx.id,
          platform: 'youtube',
          videoUrl: row.external_url,
        }),
      );
    }

    const settled = await Promise.allSettled(dispatchPromises);

    const results: IngestionResult[] = contexts.map((ctx, index) => {
      const pre = precomputedResults[index];
      if (pre) return pre;

      const outcome = settled[index];
      if (outcome.status === 'fulfilled' && outcome.value) {
        return outcome.value;
      }

      const reason =
        outcome.status === 'rejected'
          ? outcome.reason
          : 'Unknown ingestion result';
      const message =
        reason instanceof Error ? reason.message : String(reason ?? '');

      return {
        ok: false,
        submissionId: ctx.id,
        platform: 'youtube',
        error: message,
        errorCode: 'UNKNOWN_ERROR',
      };
    });

    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.length - succeeded;

    if (succeeded > 0) {
      // Fire & forget: we don't await to avoid blocking the response
      void admin.rpc('refresh_all_materialized_views');
    }

    return NextResponse.json({
      ok: true,
      processed: results.length,
      succeeded,
      failed,
      results,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal error';
    console.error('[ingestion:fetch-metrics] unexpected error', { message });
    return NextResponse.json(
      { ok: false, message: 'Internal server error' },
      { status: 500 },
    );
  }
}

