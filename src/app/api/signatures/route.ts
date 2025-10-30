import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';
import { z } from 'zod';

// Schéma de validation pour les paramètres de requête
const SignatureQuerySchema = z.object({
  submission_id: z.string().uuid().optional(),
  signed_by: z.string().uuid().optional(),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional().default("20"),
  offset: z.string().transform(Number).pipe(z.number().min(0)).optional().default("0"),
});

// Schéma de validation pour la création d'une signature
const CreateSignatureSchema = z.object({
  submission_id: z.string().uuid(),
  signature_meta: z.record(z.string(), z.any()).optional().default({}),
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
    const { submission_id, signed_by, limit, offset } = SignatureQuerySchema.parse(queryParams);

    let query = supabase
      .from('signatures')
      .select(`
        id,
        submission_id,
        signed_by,
        signed_at,
        signature_meta,
        submissions!inner(
          id,
          contest_id,
          creator_id,
          video_url,
          platform,
          platform_video_id,
          status,
          profiles!inner(
            id,
            name,
            handle,
            profile_image_url
          ),
          contests!inner(
            id,
            title,
            brand_id
          )
        ),
        profiles:signed_by(
          id,
          name,
          handle,
          profile_image_url
        )
      `)
      .order('signed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filtrer par submission_id si fourni
    if (submission_id) {
      query = query.eq('submission_id', submission_id);
    }

    // Filtrer par signed_by si fourni
    if (signed_by) {
      query = query.eq('signed_by', signed_by);
    }

    const { data: signatures, error } = await query;

    if (error) {
      console.error('Erreur lors de la récupération des signatures:', error);
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }

    // Formater les données
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedSignatures = signatures?.map((signature: any) => ({
      id: signature.id,
      submission_id: signature.submission_id,
      signed_by: signature.signed_by,
      signed_at: signature.signed_at,
      signature_meta: signature.signature_meta,
      submission: {
        id: signature.submissions.id,
        contest_id: signature.submissions.contest_id,
        creator_id: signature.submissions.creator_id,
        video_url: signature.submissions.video_url,
        platform: signature.submissions.platform,
        platform_video_id: signature.submissions.platform_video_id,
        status: signature.submissions.status,
        creator: signature.submissions.profiles,
        contest: signature.submissions.contests
      },
      signer: signature.profiles
    })) || [];

    return NextResponse.json({
      success: true,
      data: formattedSignatures,
      pagination: {
        limit,
        offset,
        total: formattedSignatures.length
      }
    });

  } catch (error) {
    console.error('Erreur dans GET /api/signatures:', error);
    
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

    // Valider les données de la requête
    const body = await request.json();
    const { submission_id, signature_meta } = CreateSignatureSchema.parse(body);

    // Vérifier que la soumission existe
    const { data: submission } = await supabase
      .from('submissions')
      .select(`
        id,
        contest_id,
        creator_id,
        status,
        contests!inner(
          id,
          brand_id
        )
      `)
      .eq('id', submission_id)
      .single();

    if (!submission) {
      return NextResponse.json({ error: 'Soumission non trouvée' }, { status: 404 });
    }

    // Vérifier les permissions
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role === 'admin';
    const isCreator = submission.creator_id === user.id;
    const isBrandOwner = submission.contests[0]?.brand_id === user.id;

    if (!isAdmin && !isCreator && !isBrandOwner) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    // Vérifier qu'une signature n'existe pas déjà pour cette soumission par cet utilisateur
    const { data: existingSignature } = await supabase
      .from('signatures')
      .select('id')
      .eq('submission_id', submission_id)
      .eq('signed_by', user.id)
      .single();

    if (existingSignature) {
      return NextResponse.json({ error: 'Signature déjà existante' }, { status: 409 });
    }

    // Créer la signature
    const { data: signature, error } = await supabase
      .from('signatures')
      .insert({
        submission_id,
        signed_by: user.id,
        signature_meta: {
          ...signature_meta,
          user_role: profile?.role,
          ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
          user_agent: request.headers.get('user-agent'),
          timestamp: new Date().toISOString()
        }
      })
      .select(`
        id,
        submission_id,
        signed_by,
        signed_at,
        signature_meta,
        submissions!inner(
          id,
          contest_id,
          creator_id,
          video_url,
          platform,
          platform_video_id,
          status
        )
      `)
      .single();

    if (error) {
      console.error('Erreur lors de la création de la signature:', error);
      return NextResponse.json({ error: 'Erreur lors de la création' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: signature
    }, { status: 201 });

  } catch (error) {
    console.error('Erreur dans POST /api/signatures:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Données invalides', 
        details: error.issues 
      }, { status: 400 });
    }

    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
