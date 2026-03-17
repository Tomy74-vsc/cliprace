import { task } from '@trigger.dev/sdk/v3';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { ingestSubmissionTask } from './ingest-submission.task';

export const ingestBatchTask = task({
  id: 'ingest-batch',
  maxDuration: 300,
  run: async (payload: { platform?: string; limit?: number }) => {
    const admin = getSupabaseAdmin();
    const limit = payload.limit ?? 200;
    const platform = payload.platform;

    let query = admin
      .from('submissions')
      .select(
        'id, contest_id, creator_id, platform, external_url, contest:contests!inner(status)',
      )
      .in('status', ['pending', 'approved'])
      .in('contest.status', ['active', 'reviewing'])
      .limit(limit);

    if (platform) {
      query = query.eq('platform', platform);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch submissions: ${error.message}`);
    }

    const submissions = (data ?? []) as Array<{
      id: string;
      contest_id: string;
      creator_id: string;
      platform: string;
      external_url: string;
    }>;

    if (submissions.length === 0) {
      return { triggered: 0, message: 'No submissions to ingest' };
    }

    await ingestSubmissionTask.batchTrigger(
      submissions.map((s) => ({
        payload: {
          submissionId: s.id,
          contestId: s.contest_id,
          creatorId: s.creator_id,
          platform: s.platform,
          externalUrl: s.external_url,
        },
      })),
    );

    return {
      triggered: submissions.length,
      platforms: [...new Set(submissions.map((s) => s.platform))],
    };
  },
});

