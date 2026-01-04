/*
Source: PATCH /api/submissions/[id]/moderate
Tables: submissions, moderation_actions, notifications, audit_logs
Rules:
- Only brand owner of the contest or admin can moderate
- status ∈ {'approved','rejected'}; reason optional for rejected
*/
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseSSR } from '@/lib/supabase/ssr';
import { getUserRole } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase/server';

const BodySchema = z.object({
  status: z.enum(['approved', 'rejected', 'removed']),
  reason: z.string().max(500).optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: submissionId } = await context.params;
    const supabaseSSR = await getSupabaseSSR();
    const {
      data: { user },
    } = await supabaseSSR.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });

    const role = await getUserRole(user.id);
    if (!role) return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });

    const json = await req.json();
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, message: 'Invalid body', errors: parsed.error.flatten() }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    // Load submission + contest ownership
    const { data: sub, error: subErr } = await admin
      .from('submissions')
      .select('id, contest_id, creator_id, status, rejection_reason')
      .eq('id', submissionId)
      .single();
    if (subErr || !sub) return NextResponse.json({ ok: false, message: 'Submission not found' }, { status: 404 });

    const { data: contest, error: contestErr } = await admin
      .from('contests')
      .select('id, brand_id')
      .eq('id', sub.contest_id)
      .single();
    if (contestErr || !contest) return NextResponse.json({ ok: false, message: 'Contest not found' }, { status: 404 });

    const isOwner = contest.brand_id === user.id;
    const isAdmin = role === 'admin';
    if (!isOwner && !isAdmin) return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });

    const { status, reason } = parsed.data;
    if ((status === 'rejected' || status === 'removed') && !reason) {
      return NextResponse.json({ ok: false, message: 'Reason required for rejection/removal' }, { status: 400 });
    }

    // Update submission
    const updatePayload: Record<string, any> = {
      status,
      moderated_by: user.id,
      updated_at: new Date().toISOString(),
    };
    if (status === 'approved') {
      updatePayload.rejection_reason = null;
      updatePayload.approved_at = new Date().toISOString();
    } else {
      updatePayload.rejection_reason = reason ?? null;
      updatePayload.approved_at = null;
    }
    if (reason) updatePayload.moderation_notes = reason;

    const { error: updErr } = await admin
      .from('submissions')
      .update(updatePayload)
      .eq('id', submissionId);
    if (updErr) return NextResponse.json({ ok: false, message: 'Update failed', error: updErr.message }, { status: 500 });

    // Update moderation queue status
    await admin
      .from('moderation_queue')
      .update({
        status: 'completed',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('submission_id', submissionId);
    // Write moderation action
    await admin.from('moderation_actions').insert({
      target_table: 'submissions',
      target_id: submissionId,
      action: status === 'approved' ? 'approve' : status === 'removed' ? 'remove' : 'reject',
      reason: reason ?? null,
      actor_id: user.id,
    });

    // Notify creator
    const { notifyCreatorAboutModeration } = await import('@/lib/notifications');
    await notifyCreatorAboutModeration(
      sub.creator_id,
      sub.id,
      sub.contest_id,
      status,
      reason ?? null,
      admin
    );

    // Audit
    const ip = req.headers.get('x-forwarded-for') ?? undefined;
    const ua = req.headers.get('user-agent') ?? undefined;
    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'submission_moderate',
      table_name: 'submissions',
      row_pk: sub.id,
      old_values: { status: sub.status, rejection_reason: sub.rejection_reason },
      new_values: updatePayload,
      ip,
      user_agent: ua,
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

