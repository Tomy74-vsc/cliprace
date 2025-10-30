import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase, getServerUser } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
    const supabase = await getServerSupabase();
    const body = await req.json();
    const user = await getServerUser();
    
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Validation des données d'entrée
    if (!body.title || typeof body.title !== 'string') {
        return NextResponse.json({ error: "Titre requis" }, { status: 400 });
    }
    
    if (!body.description || typeof body.description !== 'string') {
        return NextResponse.json({ error: "Description requise" }, { status: 400 });
    }
    
    if (typeof body.total_prize_cents !== 'number' || body.total_prize_cents < 0) {
        return NextResponse.json({ error: "Montant du prix invalide" }, { status: 400 });
    }
    
    // Création du concours avec validation
    const insert = {
        brand_id: user.id,
        title: body.title,
        description: body.description,
        status: "draft",
        total_prize_cents: body.total_prize_cents,
        created_at: new Date().toISOString(),
    };
    
    const { data, error } = await supabase
        .from("contests")
        .insert(insert)
        .select("id, title, status")
        .single();
        
    if (error) {
        console.error('Erreur lors de la création du concours:', error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    return NextResponse.json({ 
        success: true,
        data: { id: data.id, title: data.title, status: data.status }
    });
}


