import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { z } from 'zod';

// Schéma de validation pour les paramètres de route
const NotificationIdSchema = z.string().uuid();

// Schéma de validation pour la mise à jour d'une notification
const UpdateNotificationSchema = z.object({
  read: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await getServerSupabase();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Valider l'ID de la notification
    const notification_id = NotificationIdSchema.parse(params.id);

    // Récupérer la notification
    const { data: notification, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', notification_id)
      .eq('user_id', user.id) // S'assurer que l'utilisateur ne peut voir que ses notifications
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Notification non trouvée' }, { status: 404 });
      }
      console.error('Erreur lors de la récupération de la notification:', error);
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: notification
    });

  } catch (error) {
    console.error('Erreur dans GET /api/notifications/[id]:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'ID invalide', 
        details: error.issues 
      }, { status: 400 });
    }

    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await getServerSupabase();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Valider l'ID de la notification
    const notification_id = NotificationIdSchema.parse(params.id);

    // Valider les données de la requête
    const body = await request.json();
    const updateData = UpdateNotificationSchema.parse(body);

    // Mettre à jour la notification
    const { data: notification, error } = await supabase
      .from('notifications')
      .update(updateData)
      .eq('id', notification_id)
      .eq('user_id', user.id) // S'assurer que l'utilisateur ne peut modifier que ses notifications
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Notification non trouvée' }, { status: 404 });
      }
      console.error('Erreur lors de la mise à jour de la notification:', error);
      return NextResponse.json({ error: 'Erreur lors de la mise à jour' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: notification
    });

  } catch (error) {
    console.error('Erreur dans PATCH /api/notifications/[id]:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Données invalides', 
        details: error.issues 
      }, { status: 400 });
    }

    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await getServerSupabase();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Valider l'ID de la notification
    const notification_id = NotificationIdSchema.parse(params.id);

    // Supprimer la notification
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notification_id)
      .eq('user_id', user.id); // S'assurer que l'utilisateur ne peut supprimer que ses notifications

    if (error) {
      console.error('Erreur lors de la suppression de la notification:', error);
      return NextResponse.json({ error: 'Erreur lors de la suppression' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Notification supprimée avec succès'
    });

  } catch (error) {
    console.error('Erreur dans DELETE /api/notifications/[id]:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'ID invalide', 
        details: error.issues 
      }, { status: 400 });
    }

    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
