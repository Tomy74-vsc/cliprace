# Metrics Poller Edge Function

Cette fonction Supabase Edge (Deno) récupère les métriques des vidéos soumises sur différentes plateformes (YouTube, TikTok, Instagram).

## 🚀 Déploiement

### Prérequis

- [Supabase CLI](https://supabase.com/docs/guides/cli) installé
- Projet Supabase configuré

### Commandes

```bash
# Déployer la fonction
supabase functions deploy metrics-poller

# Tester localement
supabase functions serve metrics-poller

# Voir les logs
supabase functions logs metrics-poller
```

## ⚙️ Configuration

### Variables d'environnement

Définir dans le dashboard Supabase (Settings > Edge Functions > Secrets) :

```bash
# Automatiquement disponibles
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# API Keys des plateformes (à ajouter)
YOUTUBE_API_KEY=your-youtube-api-key
TIKTOK_CLIENT_KEY=your-tiktok-client-key
TIKTOK_CLIENT_SECRET=your-tiktok-client-secret
INSTAGRAM_CLIENT_ID=your-instagram-client-id
INSTAGRAM_CLIENT_SECRET=your-instagram-client-secret
```

### Planification (Cron)

Créer un job cron dans Supabase Dashboard :

```sql
-- Exécuter toutes les 5 minutes
SELECT cron.schedule(
  'metrics-poller-job',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
      url:='https://your-project-ref.supabase.co/functions/v1/metrics-poller',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
      body:='{}'::jsonb
    ) AS request_id;
  $$
);
```

## 📝 Implémentation des APIs de plateformes

### ⚠️ TODO : Fonctions à implémenter

Le fichier actuel retourne des erreurs car les intégrations d'API de plateformes ne sont pas implémentées. Vous devez :

#### 1. YouTube Data API v3

```typescript
async function fetchYouTubeMetrics(submission: SubmissionToProcess) {
  const apiKey = Deno.env.get('YOUTUBE_API_KEY');
  const videoId = submission.platform_video_id;
  
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=statistics,contentDetails&key=${apiKey}`
  );
  
  const data = await response.json();
  const video = data.items?.[0];
  
  if (!video) throw new Error('Video not found');
  
  return {
    views: parseInt(video.statistics.viewCount || '0'),
    likes: parseInt(video.statistics.likeCount || '0'),
    comments: parseInt(video.statistics.commentCount || '0'),
    shares: 0, // Not available in YouTube API
    duration_seconds: parseDuration(video.contentDetails.duration),
  };
}

function parseDuration(isoDuration: string): number {
  // Convertir PT1M30S en 90 secondes
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const [, hours, minutes, seconds] = match;
  return (parseInt(hours || '0') * 3600) + 
         (parseInt(minutes || '0') * 60) + 
         parseInt(seconds || '0');
}
```

#### 2. TikTok Research API

```typescript
async function fetchTikTokMetrics(submission: SubmissionToProcess, supabase: SupabaseClient) {
  // 1. Récupérer le access_token du créateur depuis la base de données
  const { data: profile } = await supabase
    .from('profiles_creator')
    .select('social_media')
    .eq('id', submission.creator_id)
    .single();
  
  const tiktokTokens = (profile?.social_media as any)?.tiktok;
  const accessToken = tiktokTokens?.access_token;
  
  if (!accessToken) {
    throw new Error('TikTok access token not found');
  }
  
  // 2. Appeler l'API TikTok
  const response = await fetch(
    `https://open.tiktokapis.com/v2/research/video/query/`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: {
          and: [
            { field_name: 'video_id', operation: 'EQ', field_values: [submission.platform_video_id] }
          ]
        },
        max_count: 1,
      }),
    }
  );
  
  const data = await response.json();
  const video = data.data?.videos?.[0];
  
  if (!video) throw new Error('Video not found');
  
  return {
    views: video.view_count || 0,
    likes: video.like_count || 0,
    comments: video.comment_count || 0,
    shares: video.share_count || 0,
    duration_seconds: video.duration || 0,
  };
}
```

#### 3. Instagram Graph API

```typescript
async function fetchInstagramMetrics(submission: SubmissionToProcess, supabase: SupabaseClient) {
  // 1. Récupérer le access_token du créateur
  const { data: profile } = await supabase
    .from('profiles_creator')
    .select('social_media')
    .eq('id', submission.creator_id)
    .single();
  
  const instagramTokens = (profile?.social_media as any)?.instagram;
  const accessToken = instagramTokens?.access_token;
  
  if (!accessToken) {
    throw new Error('Instagram access token not found');
  }
  
  // 2. Appeler l'API Instagram
  const mediaId = submission.platform_video_id;
  const fields = 'like_count,comments_count,video_views,timestamp';
  
  const response = await fetch(
    `https://graph.instagram.com/v18.0/${mediaId}?fields=${fields}&access_token=${accessToken}`
  );
  
  const data = await response.json();
  
  if (data.error) throw new Error(data.error.message);
  
  return {
    views: data.video_views || 0,
    likes: data.like_count || 0,
    comments: data.comments_count || 0,
    shares: 0, // Not available in Instagram API
    duration_seconds: 0, // Would need separate call
  };
}
```

### Où ajouter ces fonctions ?

Ajoutez ces fonctions dans `src/functions/metrics-poller/index.ts` juste après la fonction `processSubmissions()` et modifiez la fonction `processSubmission()` pour les utiliser.

## 🔒 Sécurité

- ✅ Utilise `SUPABASE_SERVICE_ROLE_KEY` (jamais exposée au client)
- ✅ Rate limiting par plateforme
- ✅ Retry avec backoff exponentiel
- ✅ Logs structurés pour monitoring
- ⚠️ Assurez-vous de valider les tokens d'accès avant utilisation
- ⚠️ Gérez l'expiration et le refresh des tokens OAuth

## 📊 Monitoring

### Logs

```bash
# Voir les logs en temps réel
supabase functions logs metrics-poller --tail

# Filtrer par niveau
supabase functions logs metrics-poller --level error
```

### Métriques à surveiller

- Taux de succès par plateforme
- Durée d'exécution moyenne
- Nombre de soumissions traitées
- Erreurs d'API (rate limits, tokens expirés)

## 🧪 Tests

### Test manuel

```bash
curl -X POST https://your-project-ref.supabase.co/functions/v1/metrics-poller \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Réponse attendue

```json
{
  "success": true,
  "message": "Processed 10 submissions",
  "processed": 10,
  "success_count": 8,
  "failure_count": 2,
  "duration_ms": 1234,
  "results": [
    {
      "submission_id": "uuid",
      "success": true,
      "platform": "youtube",
      "error": null
    }
  ]
}
```

## 📚 Ressources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [YouTube Data API](https://developers.google.com/youtube/v3)
- [TikTok Research API](https://developers.tiktok.com/doc/research-api-overview/)
- [Instagram Graph API](https://developers.facebook.com/docs/instagram-api/)
- [Deno Runtime](https://deno.land/manual)

## ⚠️ Limitations actuelles

1. **APIs non implémentées** : Les appels aux APIs YouTube/TikTok/Instagram doivent être ajoutés
2. **Gestion des tokens** : Pas de refresh automatique des tokens OAuth expirés
3. **Rate limiting externe** : Pas de gestion des limites d'API des plateformes
4. **Métriques historiques** : Pas de comparaison avec les métriques précédentes

## 🔄 Prochaines étapes

1. ✅ Implémenter les 3 fonctions d'API de plateformes
2. ✅ Ajouter la gestion du refresh de tokens OAuth
3. ✅ Implémenter la gestion des rate limits externes
4. ✅ Ajouter des alertes en cas d'échec répété
5. ✅ Créer un dashboard de monitoring

