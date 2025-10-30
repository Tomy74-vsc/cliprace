"use client";
import { useState, useEffect } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import {  
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  Globe, 
  Edit, 
  Save, 
  X,
  Camera
} from "lucide-react";
import Image from "next/image";

type BrandProfile = {
  id: string;
  company_name: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  website: string;
  logo_url: string;
  description: string;
  created_at: string;
  updated_at: string;
};

export default function BrandProfilePage() {
  const supabase = getBrowserSupabase();
  const [profile, setProfile] = useState<BrandProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<BrandProfile>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      try {
        const { data: profileData } = await supabase
          .from("profiles_brand")
          .select("*")
          .eq("user_id", user.id)
          .single();

        if (profileData) {
          setProfile(profileData as BrandProfile);
          setFormData(profileData);
        }
        setLoading(false);
      } catch (error) {
        console.error("Error loading profile:", error);
        setLoading(false);
      }
    }
    loadProfile();
  }, [supabase]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("profiles_brand")
        .upsert({
          user_id: user.id,
          ...formData,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      setProfile({ ...profile, ...formData } as BrandProfile);
      setEditing(false);
    } catch (error) {
      console.error("Error saving profile:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(profile || {});
    setEditing(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
          <div className="h-64 bg-zinc-200 dark:bg-zinc-800 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            Profil de la marque
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Gérez les informations de votre entreprise
          </p>
        </div>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:shadow-md hover:scale-105"
          >
            <Edit className="h-4 w-4" />
            Modifier
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancel}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <X className="h-4 w-4" />
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:shadow-md disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Sauvegarder
                </>
              )}
            </button>
          </div>
        )}
      </motion.div>

      {/* Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
      >
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Logo Section */}
          <div className="lg:col-span-1">
            <div className="text-center">
              <div className="relative mx-auto h-32 w-32 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-900 dark:to-indigo-900">
                {profile?.logo_url ? (
                  <Image
                    src={profile.logo_url}
                    alt="Logo"
                    width={128}
                    height={128}
                    className="h-full w-full rounded-2xl object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Building2 className="h-16 w-16 text-violet-600" />
                  </div>
                )}
                {editing && (
                  <button 
                    className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg hover:bg-violet-700"
                    aria-label="Changer le logo"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                )}
              </div>
              <h2 className="mt-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {editing ? (
                  <input
                    type="text"
                    value={formData.company_name || ""}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    placeholder="Nom de l'entreprise"
                    className="text-center bg-transparent border-none outline-none text-xl font-semibold"
                  />
                ) : (
                  profile?.company_name || "Nom de l'entreprise"
                )}
              </h2>
              {editing ? (
                <textarea
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description de l'entreprise"
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-800"
                />
              ) : (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {profile?.description || "Aucune description"}
                </p>
              )}
            </div>
          </div>

          {/* Details Section */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  <Mail className="h-4 w-4 inline mr-2" />
                  Email de contact
                </label>
                {editing ? (
                  <input
                    type="email"
                    value={formData.contact_email || ""}
                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                    placeholder="contact@entreprise.com"
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                ) : (
                  <p className="text-sm text-zinc-900 dark:text-zinc-100">
                    {profile?.contact_email || "Non renseigné"}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  <Phone className="h-4 w-4 inline mr-2" />
                  Téléphone
                </label>
                {editing ? (
                  <input
                    type="tel"
                    value={formData.contact_phone || ""}
                    onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                    placeholder="+33 1 23 45 67 89"
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                ) : (
                  <p className="text-sm text-zinc-900 dark:text-zinc-100">
                    {profile?.contact_phone || "Non renseigné"}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  <MapPin className="h-4 w-4 inline mr-2" />
                  Adresse
                </label>
                {editing ? (
                  <input
                    type="text"
                    value={formData.address || ""}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="123 Rue de la Paix, 75001 Paris"
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                ) : (
                  <p className="text-sm text-zinc-900 dark:text-zinc-100">
                    {profile?.address || "Non renseigné"}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  <Globe className="h-4 w-4 inline mr-2" />
                  Site web
                </label>
                {editing ? (
                  <input
                    type="url"
                    value={formData.website || ""}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://www.entreprise.com"
                    className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                ) : (
                  <p className="text-sm text-zinc-900 dark:text-zinc-100">
                    {profile?.website ? (
                      <a
                        href={profile.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300"
                      >
                        {profile.website}
                      </a>
                    ) : (
                      "Non renseigné"
                    )}
                  </p>
                )}
              </div>
            </div>

            {/* Account Info */}
            <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-700">
              <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-4">
                Informations du compte
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Membre depuis</p>
                  <p className="text-sm text-zinc-900 dark:text-zinc-100">
                    {profile?.created_at ? new Date(profile.created_at).toLocaleDateString("fr-FR") : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Dernière mise à jour</p>
                  <p className="text-sm text-zinc-900 dark:text-zinc-100">
                    {profile?.updated_at ? new Date(profile.updated_at).toLocaleDateString("fr-FR") : "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
