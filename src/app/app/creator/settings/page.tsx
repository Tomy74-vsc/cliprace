import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getSupabaseSSR } from "@/lib/supabase/ssr";
import { CreatorSettingsForm } from "@/components/settings/creator-settings-form";
import { TrackOnView } from "@/components/analytics/track-once";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default async function CreatorSettingsPage() {
  const { user } = await getSession();
  if (!user) {
    redirect("/auth/login");
  }

  const supabase = await getSupabaseSSR();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name, bio, avatar_url")
    .eq("id", user.id)
    .single();

  const { data: creatorDetails, error: creatorError } = await supabase
    .from("profile_creators")
    .select("first_name, last_name, handle, primary_platform, followers, avg_views")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: notificationPrefs, error: notificationError } = await supabase
    .from("notification_preferences")
    .select("event, channel, enabled")
    .eq("user_id", user.id);

  if (profileError) console.error("Profile fetch error", profileError);
  if (creatorError) console.error("Creator details error", creatorError);
  if (notificationError) console.error("Notification prefs error", notificationError);

  const completion = computeCompletion({ profile, creator: creatorDetails });
  const profileIncomplete = completion.percent < 80;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <TrackOnView
        event="view_creator_settings"
        payload={{
          has_profile: Boolean(profile),
          has_creator_details: Boolean(creatorDetails),
        }}
      />

      <div>
        <h1 className="display-3 mb-2">Paramètres</h1>
        <p className="text-sm text-muted-foreground">
          Gérez votre profil créateur, vos préférences de notification et la sécurité de votre compte.
        </p>
      </div>

      {profileIncomplete && (
        <Alert>
          <AlertTitle>Profil incomplet</AlertTitle>
          <AlertDescription>
            Un profil incomplet peut bloquer l&apos;accès à certains concours. Complétez les champs ci-dessous pour
            débloquer plus d&apos;opportunités et améliorer vos recommandations.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle>Résumé profil</CardTitle>
            <CardDescription>Taux de complétion et aperçu public.</CardDescription>
          </div>
          <Badge variant={completion.percent >= 80 ? "success" : "secondary"}>
            {completion.percent}% complété
          </Badge>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="h-12 w-12">
            <AvatarImage src={profile?.avatar_url || ""} alt={profile?.display_name || "Créateur"} />
            <AvatarFallback>
              {(profile?.display_name || "CR").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1 text-sm">
            <div className="font-semibold text-foreground">
              {profile?.display_name || "Nom non renseigné"}
            </div>
            <div className="text-muted-foreground">
              {creatorDetails?.primary_platform || "Plateforme ?"} ·{" "}
              {creatorDetails?.followers ?? 0} followers ·{" "}
              {creatorDetails?.avg_views ?? 0} vues moyennes.
            </div>
          </div>
        </CardContent>
      </Card>

      <CreatorSettingsForm
        initialProfile={{
          display_name: profile?.display_name || "",
          bio: profile?.bio || "",
          avatar_url: profile?.avatar_url || "",
        }}
        initialCreator={{
          first_name: creatorDetails?.first_name || "",
          last_name: creatorDetails?.last_name || "",
          handle: creatorDetails?.handle || "",
          primary_platform:
            (creatorDetails?.primary_platform as "tiktok" | "instagram" | "youtube") || "tiktok",
          followers: creatorDetails?.followers ?? 0,
          avg_views: creatorDetails?.avg_views ?? 0,
        }}
        notificationPreferences={notificationPrefs || []}
      />
    </main>
  );
}

function computeCompletion({
  profile,
  creator,
}: {
  profile?: { display_name?: string | null; bio?: string | null; avatar_url?: string | null } | null;
  creator?: {
    first_name?: string | null;
    last_name?: string | null;
    handle?: string | null;
    primary_platform?: string | null;
    followers?: number | null;
    avg_views?: number | null;
  } | null;
}) {
  const fields = [
    Boolean(profile?.display_name),
    Boolean(profile?.bio),
    Boolean(profile?.avatar_url),
    Boolean(creator?.first_name),
    Boolean(creator?.last_name),
    Boolean(creator?.handle),
    Boolean(creator?.primary_platform),
    (creator?.followers ?? 0) > 0,
    (creator?.avg_views ?? 0) > 0,
  ];
  const completed = fields.filter(Boolean).length;
  const percent = Math.round((completed / fields.length) * 100);
  return { completed, total: fields.length, percent };
}
