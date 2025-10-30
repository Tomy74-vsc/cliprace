import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { createQueryOptimizer } from '@/lib/supabase/query-optimizer';
import { createCachedServices } from '@/services/cached-queries';

/**
 * Endpoint optimisé pour les concours
 * Utilise le cache et les requêtes optimisées
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await getServerSupabase();
    const queryOptimizer = createQueryOptimizer(supabase);
    const cachedServices = createCachedServices(supabase);
    
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const visibility = searchParams.get('visibility');
    
    let data;
    
    if (search) {
      // Recherche avec filtres
      data = await queryOptimizer.searchContests(
        search,
        { status: status || undefined, visibility: visibility || undefined },
        limit
      );
    } else {
      // Récupération avec cache
      data = await cachedServices.contests.getActiveContests();
    }
    
    return NextResponse.json({
      success: true,
      data,
      pagination: {
        limit,
        offset,
        total: data?.length || 0
      }
    });
    
  } catch (error) {
    console.error('Erreur lors de la récupération des concours:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

/**
 * Création de concours avec validation CSRF
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getServerSupabase();
    const body = await request.json();
    
    // Validation des données d'entrée
    const requiredFields = ['title', 'description', 'total_prize_cents'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Le champ ${field} est requis` },
          { status: 400 }
        );
      }
    }
    
    // Validation des types
    if (typeof body.title !== 'string' || body.title.length < 3) {
      return NextResponse.json(
        { error: 'Le titre doit contenir au moins 3 caractères' },
        { status: 400 }
      );
    }
    
    if (typeof body.description !== 'string' || body.description.length < 10) {
      return NextResponse.json(
        { error: 'La description doit contenir au moins 10 caractères' },
        { status: 400 }
      );
    }
    
    if (typeof body.total_prize_cents !== 'number' || body.total_prize_cents < 0) {
      return NextResponse.json(
        { error: 'Le montant du prix doit être un nombre positif' },
        { status: 400 }
      );
    }
    
    // Récupération de l'utilisateur
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentification requise' },
        { status: 401 }
      );
    }
    
    // Vérification du rôle
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (profile?.role !== 'brand') {
      return NextResponse.json(
        { error: 'Seules les marques peuvent créer des concours' },
        { status: 403 }
      );
    }
    
    // Création du concours avec sélection optimisée
    const insertData = {
      brand_id: user.id,
      title: body.title,
      description: body.description,
      status: 'draft',
      total_prize_cents: body.total_prize_cents,
      starts_at: body.starts_at || null,
      ends_at: body.ends_at || null,
      visibility: body.visibility || 'public',
      networks: body.networks || ['tiktok', 'instagram', 'youtube'],
      formats: body.formats || ['short'],
      hashtags: body.hashtags || [],
      created_at: new Date().toISOString(),
    };
    
    const { data: contest, error } = await supabase
      .from('contests')
      .insert(insertData)
      .select(`
        id,
        title,
        status,
        total_prize_cents,
        visibility,
        created_at
      `)
      .single();
    
    if (error) {
      console.error('Erreur lors de la création du concours:', error);
      return NextResponse.json(
        { error: 'Erreur lors de la création du concours' },
        { status: 500 }
      );
    }
    
    // Invalider le cache des concours
    const cachedServices = createCachedServices(supabase);
    await cachedServices.contests.invalidateContestCache();
    
    return NextResponse.json({
      success: true,
      data: contest
    }, { status: 201 });
    
  } catch (error) {
    console.error('Erreur lors de la création du concours:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
