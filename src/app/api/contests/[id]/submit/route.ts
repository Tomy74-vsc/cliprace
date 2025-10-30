import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getServerUser } from '@/lib/supabase/server';
import { createSubmissionSchema, detectPlatformFromUrl, extractPlatformVideoId } from '@/lib/validation/submission';
import { generateAndUploadContract } from '@/lib/contracts';
import { collectImmediateMetrics } from '@/lib/metrics/immediate-collection';
import { createNotification } from '@/lib/notifications';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// Validate contest ID parameter
const contestIdSchema = z.string().uuid('Invalid contest ID format');

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let contestId: string | undefined;
  let user: any;
  
  try {
    // Validate contest ID
    const { id } = await params;
    const contestIdResult = contestIdSchema.safeParse(id);
    if (!contestIdResult.success) {
      return NextResponse.json(
        { error: 'Invalid contest ID format' },
        { status: 400 }
      );
    }
    contestId = contestIdResult.data;

    // Authenticate user
    const supabase = await getServerSupabase();
    user = await getServerUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = createSubmissionSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: validationResult.error.issues
        },
        { status: 400 }
      );
    }
    const { video_url, platform, platform_video_id, meta } = validationResult.data;

    // Verify user is a creator
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'creator') {
      return NextResponse.json(
        { error: 'Only creators can submit content' },
        { status: 403 }
      );
    }

    // Fetch contest details and verify it exists and is active/scheduled
    const { data: contest, error: contestError } = await supabase
      .from('contests')
      .select('*')
      .eq('id', contestId)
      .single();

    if (contestError || !contest) {
      return NextResponse.json(
        { error: 'Contest not found' },
        { status: 404 }
      );
    }

    // Check contest status
    if (!['active', 'scheduled'].includes(contest.status)) {
      return NextResponse.json(
        { error: 'Contest is not accepting submissions' },
        { status: 403 }
      );
    }

    // Auto-detect platform if not provided
    let detectedPlatform = platform;
    if (!detectedPlatform) {
      const detected = detectPlatformFromUrl(video_url);
      if (!detected) {
        return NextResponse.json(
          { error: 'Could not detect platform from URL. Please specify platform.' },
          { status: 400 }
        );
      }
      detectedPlatform = detected;
    }

    // Verify platform is allowed for this contest
    if (contest.networks && !contest.networks.includes(detectedPlatform)) {
      return NextResponse.json(
        { error: `Platform ${detectedPlatform} is not allowed for this contest` },
        { status: 400 }
      );
    }

    // Auto-extract platform video ID if not provided
    let extractedVideoId = platform_video_id;
    if (!extractedVideoId && detectedPlatform) {
      const extracted = extractPlatformVideoId(video_url, detectedPlatform);
      if (!extracted) {
        return NextResponse.json(
          { error: 'Could not extract video ID from URL' },
          { status: 400 }
        );
      }
      extractedVideoId = extracted;
    }

    // Check for duplicate submission (constraint exists in DB, but we check first for better error message)
    const { data: existingSubmission } = await supabase
      .from('submissions')
      .select('id')
      .eq('contest_id', contestId)
      .eq('platform', detectedPlatform)
      .eq('platform_video_id', extractedVideoId)
      .single();

    if (existingSubmission) {
      return NextResponse.json(
        { error: 'This video has already been submitted to this contest' },
        { status: 409 }
      );
    }

    // Determine submission status based on contest status
    const submissionStatus = contest.status === 'scheduled' ? 'pending' : 'pending';

    // Create submission
    const { data: submission, error: submissionError } = await supabase
      .from('submissions')
      .insert({
        contest_id: contestId,
        creator_id: user.id,
        network: detectedPlatform,
        video_url,
        platform: detectedPlatform,
        platform_video_id: extractedVideoId,
        meta: meta || {},
        status: submissionStatus,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (submissionError) {
      logger.error('Submission creation error', submissionError, { contestId, userId: user.id });
      return NextResponse.json(
        { error: 'Failed to create submission' },
        { status: 500 }
      );
    }

    // Generate contract
    let contractUrl: string;
    try {
      contractUrl = await generateAndUploadContract(submission.id, contestId, user.id);
    } catch (contractError) {
      logger.error('Contract generation error', contractError as Error, { contestId, submissionId: submission.id });
      // Don't fail the submission if contract generation fails
      contractUrl = 'https://cliprace.com/contract-error';
    }

    // Create signature record
    const { error: signatureError } = await supabase
      .from('signatures')
      .insert({
        submission_id: submission.id,
        signed_by: user.id,
        signed_at: null, // Will be set when actually signed
        signature_meta: {
          contract_url: contractUrl,
          created_at: new Date().toISOString()
        }
      });

    if (signatureError) {
      logger.error('Signature record creation error', signatureError, { contestId, submissionId: submission.id });
      // Don't fail the submission if signature record creation fails
    }

    // Collect immediate metrics (async, don't block submission)
    if (extractedVideoId) {
      collectImmediateMetrics(
        submission.id,
        extractedVideoId,
        detectedPlatform,
        user.id
      ).catch(error => {
        logger.error('Immediate metrics collection failed', error, { contestId, submissionId: submission.id, platform: detectedPlatform });
        // Don't fail the submission if metrics collection fails
      });
    }

    // Log audit event
    try {
      await supabase.rpc('log_audit_event', {
        p_action: 'submission_create',
        p_entity: 'submissions',
        p_entity_id: submission.id,
        p_data: {
          contest_id: contestId,
          platform: detectedPlatform,
          video_url,
          status: submissionStatus
        }
      });
    } catch (auditError) {
      logger.error('Audit logging error', auditError as Error, { contestId, submissionId: submission.id, userId: user.id });
      // Don't fail the submission if audit logging fails
    }

    // Send notification to brand about new submission
    try {
      await createNotification(
        contest.brand_id,
        'submission_received',
        {
          submission_id: submission.id,
          contest_id: contestId
        }
      );
    } catch (notificationError) {
      logger.error('Notification error', notificationError as Error, { contestId, submissionId: submission.id, brandId: contest.brand_id });
      // Don't fail the submission if notification fails
    }

    // Determine next steps based on contest status
    const nextSteps = contest.status === 'scheduled' 
      ? [
          'Your submission has been received and is pending',
          'You will be notified when the contest becomes active',
          'Please sign the contract to complete your submission'
        ]
      : [
          'Your submission has been received and is pending review',
          'Please sign the contract to complete your submission',
          'You will be notified of the review results'
        ];

    return NextResponse.json({
      submission_id: submission.id,
      contract_url: contractUrl,
      next_steps: nextSteps,
      status: submissionStatus
    });

  } catch (error) {
    logger.error('Submission API error', error as Error, { contestId: contestId || 'unknown', userId: user?.id });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
