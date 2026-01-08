import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin/rbac';
import { getAdminClient } from '@/lib/admin/supabase';
import { createError, formatErrorResponse } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ task_type: string }> }
) {
  try {
    await requireAdminPermission('inbox.read');
    const { task_type } = await context.params;

    const admin = getAdminClient();

    // Chercher un playbook pour ce type de tâche
    // admin_playbooks utilise 'key' et 'title', pas 'task_type' directement
    // On cherche par key qui correspond au task_type
    const { data: playbook, error } = await admin
      .from('admin_playbooks')
      .select('id, key, title, summary, body_md, tags')
      .eq('key', task_type)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      throw createError('DATABASE_ERROR', 'Failed to load playbook', 500, error.message);
    }

    if (!playbook) {
      return NextResponse.json({ ok: true, playbook: null });
    }

    return NextResponse.json({
      ok: true,
      playbook: {
        id: playbook.id,
        key: playbook.key,
        title: playbook.title,
        summary: playbook.summary,
        body_md: playbook.body_md,
        tags: Array.isArray(playbook.tags) ? playbook.tags : [],
      },
    });
  } catch (error) {
    return formatErrorResponse(error);
  }
}

