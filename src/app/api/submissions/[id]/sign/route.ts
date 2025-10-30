import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase, getServerUser } from '@/lib/supabase/server';
import { signSubmissionSchema } from '@/lib/validation/submission';
import { generateSignedContract } from '@/lib/contracts';
import { z } from 'zod';

// Validate submission ID parameter
const submissionIdSchema = z.string().uuid('Invalid submission ID format');

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Validate submission ID
    const { id } = await params;
    const submissionIdResult = submissionIdSchema.safeParse(id);
    if (!submissionIdResult.success) {
      return NextResponse.json(
        { error: 'Invalid submission ID format' },
        { status: 400 }
      );
    }
    const submissionId = submissionIdResult.data;

    // Authenticate user
    const supabase = await getServerSupabase();
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = signSubmissionSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: validationResult.error.issues
        },
        { status: 400 }
      );
    }
    const { accept_terms, legal_name } = validationResult.data;

    // Fetch submission and verify ownership
    const { data: submission, error: submissionError } = await supabase
      .from('submissions')
      .select(`
        *,
        contests!inner(*)
      `)
      .eq('id', submissionId)
      .single();

    if (submissionError || !submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      );
    }

    // Verify user owns this submission
    if (submission.creator_id !== user.id) {
      return NextResponse.json(
        { error: 'You can only sign your own submissions' },
        { status: 403 }
      );
    }

    // Check if submission is already signed
    const { data: existingSignature, error: signatureError } = await supabase
      .from('signatures')
      .select('*')
      .eq('submission_id', submissionId)
      .single();

    if (signatureError && signatureError.code !== 'PGRST116') {
      console.error('Error checking existing signature:', signatureError);
      return NextResponse.json(
        { error: 'Failed to check signature status' },
        { status: 500 }
      );
    }

    if (existingSignature && existingSignature.signed_at) {
      return NextResponse.json(
        { error: 'Submission has already been signed' },
        { status: 409 }
      );
    }

    // Get client IP and user agent for audit trail
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const signedAt = new Date().toISOString();
    const signatureMeta = {
      legal_name,
      ip_address: clientIP,
      user_agent: userAgent,
      signed_at: signedAt,
      accept_terms
    };

    // Generate signed contract
    let signedContractUrl: string;
    try {
      signedContractUrl = await generateSignedContract(submissionId, {
        legalName: legal_name,
        signedAt,
        ipAddress: clientIP,
        userAgent
      });
    } catch (contractError) {
      console.error('Signed contract generation error:', contractError);
      signedContractUrl = 'https://cliprace.com/signed-contract-error';
    }

    // Update or create signature record
    let signatureRecord;
    if (existingSignature) {
      // Update existing signature record
      const { data: updatedSignature, error: updateError } = await supabase
        .from('signatures')
        .update({
          signed_at: signedAt,
          signature_meta: {
            ...existingSignature.signature_meta,
            ...signatureMeta,
            signed_contract_url: signedContractUrl
          }
        })
        .eq('id', existingSignature.id)
        .select('*')
        .single();

      if (updateError) {
        console.error('Signature update error:', updateError);
        return NextResponse.json(
          { error: 'Failed to update signature' },
          { status: 500 }
        );
      }
      signatureRecord = updatedSignature;
    } else {
      // Create new signature record
      const { data: newSignature, error: createError } = await supabase
        .from('signatures')
        .insert({
          submission_id: submissionId,
          signed_by: user.id,
          signed_at: signedAt,
          signature_meta: {
            ...signatureMeta,
            signed_contract_url: signedContractUrl
          }
        })
        .select('*')
        .single();

      if (createError) {
        console.error('Signature creation error:', createError);
        return NextResponse.json(
          { error: 'Failed to create signature' },
          { status: 500 }
        );
      }
      signatureRecord = newSignature;
    }

    // Update submission status
    const newStatus = submission.contests.status === 'active' ? 'submitted' : 'pending_automod';
    
    const { error: updateSubmissionError } = await supabase
      .from('submissions')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', submissionId);

    if (updateSubmissionError) {
      console.error('Submission status update error:', updateSubmissionError);
      // Don't fail the signature if status update fails
    }

    // Log audit event
    try {
      await supabase.rpc('log_audit_event', {
        p_action: 'submission_approve', // Using existing action type
        p_entity: 'submissions',
        p_entity_id: submissionId,
        p_data: {
          action: 'signature_completed',
          legal_name,
          signed_at: signedAt,
          new_status: newStatus,
          contract_url: signedContractUrl
        }
      });
    } catch (auditError) {
      console.error('Audit logging error:', auditError);
      // Don't fail the signature if audit logging fails
    }

    return NextResponse.json({
      submission_id: submissionId,
      status: newStatus,
      signed_at: signedAt,
      contract_url: signedContractUrl,
      signature_id: signatureRecord.id
    });

  } catch (error) {
    console.error('Signature API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
