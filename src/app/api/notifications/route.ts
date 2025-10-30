import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { z } from 'zod';

// Schéma de validation pour les paramètres de requête
const NotificationQuerySchema = z.object({
  read: z.string().transform(val => val === 'true').optional(),
  type: z.string().optional(),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional().default("20"),
  offset: z.string().transform(Number).pipe(z.number().min(0)).optional().default("0"),
});

// Schéma de validation pour la création d'une notification
const CreateNotificationSchema = z.object({
  user_id: z.string().uuid(),
  type: z.string().min(1).max(50),
  payload: z.record(z.string(), z.any()).optional().default({}),
});

// Schéma de validation pour la mise à jour d'une notification
const UpdateNotificationSchema = z.object({
  read: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await getServerSupabase();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Valider les paramètres de requête
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const { read, type, limit, offset } = NotificationQuerySchema.parse(queryParams);

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filtrer par statut de lecture
    if (read !== undefined) {
      query = query.eq('read', read);
    }

    // Filtrer par type
    if (type) {
      query = query.eq('type', type);
    }

    const { data: notifications, error } = await query;

    if (error) {
      console.error('Erreur lors de la récupération des notifications:', error);
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }

    // Compter le total des notifications non lues
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false);

    return NextResponse.json({
      success: true,
      data: notifications || [],
      pagination: {
        limit,
        offset,
        total: notifications?.length || 0,
        unread_count: unreadCount || 0
      }
    });

  } catch (error) {
    console.error('Erreur dans GET /api/notifications:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Paramètres invalides', 
        details: error.issues 
      }, { status: 400 });
    }

    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getServerSupabase();
    
    // Vérifier l'authentification
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Vérifier que l'utilisateur est admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Accès refusé - Admin requis' }, { status: 403 });
    }

    // Valider les données de la requête
    const body = await request.json();
    const { user_id, type, payload } = CreateNotificationSchema.parse(body);

    // Vérifier que l'utilisateur cible existe
    const { data: targetUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user_id)
      .single();

    if (!targetUser) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    // Créer la notification
    const { data: notification, error } = await supabase
      .from('notifications')
      .insert({
        user_id,
        type,
        payload,
        read: false
      })
      .select()
      .single();

    if (error) {
      console.error('Erreur lors de la création de la notification:', error);
      return NextResponse.json({ error: 'Erreur lors de la création' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: notification
    }, { status: 201 });

  } catch (error) {
    console.error('Erreur dans POST /api/notifications:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Données invalides', 
        details: error.issues 
      }, { status: 400 });
    }

    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
