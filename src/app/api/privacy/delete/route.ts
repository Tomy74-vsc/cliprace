import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { getAdminSupabase, deleteUserWithServiceRole } from "@/lib/supabase/admin";
import { withRateLimit } from "@/lib/rate-limit";
import { logGdprAction } from "@/lib/audit-logger";
import { z } from "zod";

const DeleteRequestSchema = z.object({
  user_id: z.string().uuid(),
  confirmation: z.string().min(10, 'Confirmation requise'),
  reason: z.string().optional(),
});

/**
 * Endpoint RGPD pour supprimer les données d'un utilisateur
 * Rate limiting: 1 requête par minute
 * ATTENTION: Cette action est irréversible
 */
export const POST = withRateLimit('/api/privacy/delete')(async (request: Request) => {
  const nextRequest = request as NextRequest;
  try {
    const supabase = await getServerSupabase();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }

    const body = await request.json();
    const { user_id, confirmation, reason } = DeleteRequestSchema.parse(body);

    // Vérifier que l'utilisateur ne peut supprimer que ses propres données
    if (user.id !== user_id) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    // Vérification de confirmation
    if (confirmation !== 'DELETE_MY_DATA') {
      return NextResponse.json({ 
        error: 'Confirmation invalide. Vous devez écrire "DELETE_MY_DATA" pour confirmer.' 
      }, { status: 400 });
    }

    // Enregistrer la demande de suppression avec logGdprAction
    await logGdprAction('DELETE_DATA_REQUEST', user_id, {
      reason: reason || 'Demande utilisateur',
      confirmation,
      request_date: new Date().toISOString()
    }, nextRequest);

    // Processus de suppression en cascade avec client admin
    const deletionResults: Record<string, { success: boolean; count: number; error?: string }> = {};
    const adminSupabase = getAdminSupabase();

    try {
      // 1. Supprimer les signatures
      const { count: signaturesCount, error: signaturesError } = await adminSupabase
        .from('signatures')
        .delete()
        .eq('signed_by', user_id);
      
      deletionResults.signatures = {
        success: !signaturesError,
        count: signaturesCount || 0,
        error: signaturesError?.message
      };

      // 2. Supprimer les messages individuels (en tant que sender)
      const { count: messagesThreadCount, error: messagesThreadError } = await adminSupabase
        .from('messages_thread')
        .delete()
        .eq('sender_id', user_id);
      
      deletionResults.messages_thread = {
        success: !messagesThreadError,
        count: messagesThreadCount || 0,
        error: messagesThreadError?.message
      };

      // 3. Supprimer les conversations (en tant que participant)
      const { count: messagesCount, error: messagesError } = await adminSupabase
        .from('messages')
        .delete()
        .or(`brand_id.eq.${user_id},creator_id.eq.${user_id}`);
      
      deletionResults.messages = {
        success: !messagesError,
        count: messagesCount || 0,
        error: messagesError?.message
      };

      // 4. Supprimer les notifications
      const { count: notificationsCount, error: notificationsError } = await adminSupabase
        .from('notifications')
        .delete()
        .eq('user_id', user_id);
      
      deletionResults.notifications = {
        success: !notificationsError,
        count: notificationsCount || 0,
        error: notificationsError?.message
      };

      // 5. Supprimer les soumissions
      const { count: submissionsCount, error: submissionsError } = await adminSupabase
        .from('submissions')
        .delete()
        .eq('creator_id', user_id);
      
      deletionResults.submissions = {
        success: !submissionsError,
        count: submissionsCount || 0,
        error: submissionsError?.message
      };

      // 6. Supprimer le profil
      const { count: profileCount, error: profileError } = await adminSupabase
        .from('profiles')
        .delete()
        .eq('id', user_id);
      
      deletionResults.profile = {
        success: !profileError,
        count: profileCount || 0,
        error: profileError?.message
      };

      // 7. Supprimer l'utilisateur de Supabase Auth avec service role
      try {
        await deleteUserWithServiceRole(user_id);
        deletionResults.auth_user = {
          success: true,
          count: 1,
          error: undefined
        };
      } catch (authDeleteError) {
        deletionResults.auth_user = {
          success: false,
          count: 0,
          error: authDeleteError instanceof Error ? authDeleteError.message : 'Unknown error'
        };
      }

      // Enregistrer le résultat de la suppression avec logGdprAction
      await logGdprAction('DELETE_DATA_COMPLETED', user_id, {
        deletion_results: deletionResults,
        completion_date: new Date().toISOString()
      }, nextRequest);

      // Vérifier s'il y a eu des erreurs
      const hasErrors = Object.values(deletionResults).some(result => !result.success);
      
      if (hasErrors) {
        return NextResponse.json({
          success: false,
          message: 'Suppression partiellement réussie avec quelques erreurs',
          results: deletionResults,
          deleted_at: new Date().toISOString()
        }, { status: 207 }); // 207 Multi-Status
      }

      return NextResponse.json({
        success: true,
        message: 'Toutes vos données ont été supprimées avec succès',
        results: deletionResults,
        deleted_at: new Date().toISOString()
      });

    } catch (deletionError) {
      console.error('Erreur lors de la suppression:', deletionError);
      
      // Enregistrer l'erreur de suppression avec logGdprAction
      await logGdprAction('DELETE_DATA_FAILED', user_id, {
        error: deletionError instanceof Error ? deletionError.message : 'Erreur inconnue',
        failure_date: new Date().toISOString()
      }, nextRequest);

      return NextResponse.json({
        success: false,
        error: 'Erreur lors de la suppression des données',
        details: deletionError instanceof Error ? deletionError.message : 'Erreur inconnue'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Erreur dans delete RGPD:', error);
    
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
