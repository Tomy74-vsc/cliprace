# Vérification Configuration Email Supabase

## ✅ Checklist de Configuration

### 1. Variables d'environnement (.env.local)

Vérifiez que vous avez ces variables :

```env
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-clé-anon
SUPABASE_SERVICE_ROLE_KEY=votre-clé-service-role
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 2. Configuration Supabase Dashboard

#### A. Authentication → URL Configuration

1. Allez dans **Authentication** → **URL Configuration**
2. Vérifiez que ces URLs sont dans **Redirect URLs** :
   - `http://localhost:3000/**`
   - `http://localhost:3000/auth/verify`
   - `http://localhost:3000/auth/callback`
   - (En production : `https://votre-domaine.com/**`)

#### B. Authentication → Email Templates

1. Allez dans **Authentication** → **Email Templates**
2. Vérifiez que les templates sont activés :
   - ✅ **Confirm signup** (template de vérification)
   - ✅ **Magic Link** (si utilisé)
   - ✅ **Change Email Address**

#### C. Authentication → Settings

1. Allez dans **Authentication** → **Settings**
2. Vérifiez :
   - ✅ **Enable email confirmations** : Activé (pour production) ou Désactivé (pour dev)
   - ✅ **Enable email signup** : Activé
   - ✅ **Site URL** : `http://localhost:3000` (ou votre URL de production)

#### D. Project Settings → API

1. Vérifiez que :
   - ✅ **Project URL** : `https://votre-projet.supabase.co`
   - ✅ **API URL** : `https://votre-projet.supabase.co`

### 3. Configuration SMTP (Optionnel mais recommandé)

Par défaut, Supabase utilise ses propres serveurs SMTP (limite de 3 emails/heure en dev).

Pour augmenter la limite ou utiliser votre propre SMTP :

1. Allez dans **Project Settings** → **Auth** → **SMTP Settings**
2. Configurez votre SMTP (Gmail, SendGrid, etc.) OU
3. Utilisez le service email de Supabase (payant pour plus d'emails)

### 4. Vérification du Code

Le code actuel utilise `authClient.auth.signUp()` qui devrait automatiquement envoyer l'email si :
- ✅ `emailRedirectTo` est correctement configuré
- ✅ L'URL de redirection est dans la liste autorisée de Supabase
- ✅ Les templates email sont activés
- ✅ La limite de rate limit n'est pas atteinte

## 🔍 Debugging

### Vérifier si l'email est envoyé

1. **Logs Supabase** :
   - Allez dans **Logs** → **Auth Logs**
   - Cherchez les événements `user_signup` et `email_sent`

2. **Console du serveur** :
   - Regardez les logs après un signup
   - Vous devriez voir : `User created successfully` avec les détails

3. **Vérifier l'email** :
   - Vérifiez le dossier spam
   - Vérifiez que l'adresse email est valide
   - En dev, vérifiez les logs Supabase pour voir si l'email a été "envoyé"

### Problèmes courants

1. **Rate limit atteint** :
   - Solution : Attendre quelques minutes ou désactiver temporairement la vérification email en dev

2. **URL de redirection non autorisée** :
   - Solution : Ajouter l'URL dans **Authentication** → **URL Configuration** → **Redirect URLs**

3. **Templates email désactivés** :
   - Solution : Activer les templates dans **Authentication** → **Email Templates**

4. **SMTP non configuré et limite atteinte** :
   - Solution : Configurer SMTP personnalisé ou attendre la réinitialisation du rate limit

## 🛠️ Solutions Rapides

### Pour le développement (désactiver vérification email)

1. Dans Supabase Dashboard : **Authentication** → **Settings**
2. Désactivez **Enable email confirmations**
3. Les utilisateurs seront créés sans besoin de vérification

### Pour tester l'envoi d'email

1. Utilisez un service comme **Mailtrap** ou **MailHog** pour capturer les emails
2. Configurez SMTP dans Supabase pour pointer vers ce service
3. Ou utilisez un email de test valide et vérifiez les logs Supabase

## 📝 Notes

- En développement, Supabase limite à **3 emails/heure** par défaut
- Les emails peuvent prendre quelques secondes à être envoyés
- Vérifiez toujours les logs Supabase pour confirmer l'envoi

