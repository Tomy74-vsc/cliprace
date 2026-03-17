import { task } from '@trigger.dev/sdk/v3';
import { ingestSubmissionWithAudit } from '@/lib/ingestion/ingest-submission';

export const ingestSubmissionTask = task({
  id: 'ingest-submission',
  maxDuration: 30,
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 2000,
    maxTimeoutInMs: 30000,
  },
  run: async (payload: {
    submissionId: string;
    contestId: string;
    creatorId: string;
    platform: string;
    externalUrl: string;
  }) => {
    const result = await ingestSubmissionWithAudit({
      id: payload.submissionId,
      contest_id: payload.contestId,
      creator_id: payload.creatorId,
      platform: payload.platform,
      external_url: payload.externalUrl,
    });

    if (!result.ok && result.code !== 'NO_TOKEN') {
      if (result.code === 'RATE_LIMIT' || result.code === 'API_ERROR') {
        throw new Error(`Retriable error: ${result.code} — ${result.error}`);
      }
    }

    return result;
  },
});

