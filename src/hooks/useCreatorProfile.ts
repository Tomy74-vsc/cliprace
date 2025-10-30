import { useState, useEffect } from 'react';
import { getBrowserSupabase } from '@/lib/supabase/client';

export interface CreatorProfile {
  id: string;
  email: string;
  name: string;
  handle: string;
  bio: string;
  country: string;
  primary_network: string;
  profile_image_url: string | null;
  social_media: {
    tiktok?: string;
    instagram?: string;
    youtube?: string;
    twitter?: string;
  };
  created_at: string;
  updated_at: string;
}

export function useCreatorProfile() {
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = getBrowserSupabase();

  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError('Utilisateur non connecté');
          setLoading(false);
          return;
        }

        // Récupérer les données depuis les deux tables
        const [mainProfile, creatorProfile] = await Promise.all([
          supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single(),
          supabase
            .from("profiles_creator")
            .select("*")
            .eq("user_id", user.id)
            .single()
        ]);

        if (mainProfile.error && creatorProfile.error) {
          setError('Profil non trouvé');
          setLoading(false);
          return;
        }

        // Combiner les données des deux tables
        const combinedProfile: CreatorProfile = {
          id: user.id,
          email: mainProfile.data?.email || user.email || '',
          name: mainProfile.data?.name || creatorProfile.data?.handle || 'Créateur',
          handle: creatorProfile.data?.handle || '',
          bio: creatorProfile.data?.bio || mainProfile.data?.description || '',
          country: creatorProfile.data?.country || 'FR',
          primary_network: creatorProfile.data?.primary_network || 'tiktok',
          profile_image_url: mainProfile.data?.profile_image_url || null,
          social_media: creatorProfile.data?.social_media || {},
          created_at: mainProfile.data?.created_at || creatorProfile.data?.created_at || new Date().toISOString(),
          updated_at: mainProfile.data?.updated_at || creatorProfile.data?.updated_at || new Date().toISOString(),
        };

        setProfile(combinedProfile);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur lors du chargement du profil');
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [supabase]);

  const updateProfile = async (updates: Partial<CreatorProfile>) => {
    if (!profile) return { success: false, error: 'Profil non chargé' };

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, error: 'Utilisateur non connecté' };

      // Mettre à jour le profil principal
      const { error: mainError } = await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          email: updates.email || profile.email,
          name: updates.name || profile.name,
          description: updates.bio || profile.bio,
          profile_image_url: updates.profile_image_url || profile.profile_image_url,
          updated_at: new Date().toISOString(),
        });

      if (mainError) {
        return { success: false, error: `Erreur profil principal: ${mainError.message}` };
      }

      // Mettre à jour le profil créateur
      const { error: creatorError } = await supabase
        .from("profiles_creator")
        .upsert({
          user_id: user.id,
          handle: updates.handle || profile.handle,
          bio: updates.bio || profile.bio,
          country: updates.country || profile.country,
          primary_network: updates.primary_network || profile.primary_network,
          social_media: updates.social_media || profile.social_media,
          updated_at: new Date().toISOString(),
        });

      if (creatorError) {
        return { success: false, error: `Erreur profil créateur: ${creatorError.message}` };
      }

      // Mettre à jour l'état local
      setProfile({ ...profile, ...updates, updated_at: new Date().toISOString() });
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Erreur inattendue' };
    }
  };

  return {
    profile,
    loading,
    error,
    updateProfile,
    refetch: () => {
      setLoading(true);
      setError(null);
      // Le useEffect se déclenchera automatiquement
    }
  };
}
