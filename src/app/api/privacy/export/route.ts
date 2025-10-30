import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { withRateLimit } from "@/lib/rate-limit";
import { logGdprAction } from "@/lib/audit-logger";
import { z } from "zod";

const ExportRequestSchema = z.object({
  user_id: z.string().uuid(),
  format: z.enum(['json', 'csv']).default('json'),
});

/**
 * Endpoint RGPD pour exporter les données d'un utilisateur
 * Rate limiting: 2 requêtes par minute
 */
export const POST = withRateLimit('/api/privacy/export')(async (request: Request) => {
  const nextRequest = request as NextRequest;
  try {
    const supabase = await getServerSupabase();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }

    const body = await request.json();
    const { user_id, format } = ExportRequestSchema.parse(body);

    // Vérifier que l'utilisateur ne peut exporter que ses propres données
    if (user.id !== user_id) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    // Collecter toutes les données de l'utilisateur
    const userData: Record<string, any> = {
      export_info: {
        user_id,
        export_date: new Date().toISOString(),
        format,
        version: '1.0'
      }
    };

    // 1. Profil utilisateur
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user_id)
      .single();

    if (profile) {
      userData.profile = profile;
    }

    // 2. Soumissions
    const { data: submissions } = await supabase
      .from('submissions')
      .select(`
        id,
        contest_id,
        video_url,
        platform,
        platform_video_id,
        status,
        created_at,
        updated_at,
        contests!inner(
          id,
          title,
          brand_id
        )
      `)
      .eq('creator_id', user_id);

    if (submissions) {
      userData.submissions = submissions;
    }

    // 3. Messages (conversations)
    const { data: messages } = await supabase
      .from('messages')
      .select(`
        id,
        brand_id,
        creator_id,
        subject,
        last_message,
        unread_for_brand,
        unread_for_creator,
        created_at,
        updated_at
      `)
      .or(`brand_id.eq.${user_id},creator_id.eq.${user_id}`);

    // 4. Messages individuels (thread)
    const { data: messagesThread } = await supabase
      .from('messages_thread')
      .select(`
        id,
        thread_id,
        sender_id,
        body,
        attachments,
        created_at
      `)
      .eq('sender_id', user_id);

    if (messages) {
      userData.messages = messages;
    }

    if (messagesThread) {
      userData.messages_thread = messagesThread;
    }

    // 5. Notifications
    const { data: notifications } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user_id);

    if (notifications) {
      userData.notifications = notifications;
    }

    // 6. Signatures
    const { data: signatures } = await supabase
      .from('signatures')
      .select(`
        id,
        submission_id,
        signed_by,
        signed_at,
        signature_meta
      `)
      .eq('signed_by', user_id);

    if (signatures) {
      userData.signatures = signatures;
    }

    // 7. Logs d'audit pour cet utilisateur
    const { data: auditLogs } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('actor_id', user_id);

    if (auditLogs) {
      userData.audit_logs = auditLogs;
    }

    // Enregistrer l'action d'export avec logGdprAction
    await logGdprAction('EXPORT_DATA', user_id, {
      format,
      export_date: new Date().toISOString()
    }, nextRequest);

    // Retourner les données selon le format demandé
    if (format === 'csv') {
      // Pour CSV, on retourne un fichier téléchargeable
      const csvData = convertToCSV(userData);
      return new NextResponse(csvData, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="user_data_${user_id}_${Date.now()}.csv"`,
        },
      });
    }

    // Format JSON par défaut
    return NextResponse.json({
      success: true,
      data: userData,
      exported_at: new Date().toISOString(),
      record_count: {
        profile: profile ? 1 : 0,
        submissions: submissions?.length || 0,
        messages: messages?.length || 0,
        notifications: notifications?.length || 0,
        signatures: signatures?.length || 0,
        audit_logs: auditLogs?.length || 0,
      }
    });

  } catch (error) {
    console.error('Erreur dans export RGPD:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Données invalides',
        details: error.issues
      }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
});

/**
 * Convertit les données en format CSV
 */
function convertToCSV(data: Record<string, any>): string {
  const lines: string[] = [];
  
  // En-tête
  lines.push('Section,Field,Value,Timestamp');
  
  // Profil
  if (data.profile) {
    Object.entries(data.profile).forEach(([key, value]) => {
      lines.push(`profile,${key},"${value}",${data.profile.updated_at || data.profile.created_at}`);
    });
  }
  
  // Soumissions
  if (data.submissions) {
    data.submissions.forEach((submission: any) => {
      Object.entries(submission).forEach(([key, value]) => {
        lines.push(`submission,${key},"${value}",${submission.created_at}`);
      });
    });
  }
  
  // Messages
  if (data.messages) {
    data.messages.forEach((message: any) => {
      Object.entries(message).forEach(([key, value]) => {
        lines.push(`message,${key},"${value}",${message.created_at}`);
      });
    });
  }
  
  return lines.join('\n');
}
