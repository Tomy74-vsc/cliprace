-- =====================================================
-- 11_rls_policies.sql
-- =====================================================
-- Politiques RLS (Row Level Security) pour toutes les tables
-- Idempotent : DROP POLICY IF EXISTS + CREATE POLICY
-- =====================================================

-- =====================================================
-- PROFILES
-- =====================================================

-- Creator : CRUD sur son propre profil
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_delete_own" ON public.profiles;
CREATE POLICY "profiles_delete_own" ON public.profiles
  FOR DELETE USING (auth.uid() = id);

-- Admin : accès complet
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL USING (public.is_admin(auth.uid()));

-- Public : lecture profils actifs (supprimée pour éviter l'exposition email)
DROP POLICY IF EXISTS "profiles_public_read_active" ON public.profiles;
-- CREATE POLICY "profiles_public_read_active" ON public.profiles
--   FOR SELECT USING (is_active = true);

-- =====================================================
-- PROFILE_BRANDS
-- =====================================================

DROP POLICY IF EXISTS "profile_brands_select_own" ON public.profile_brands;
CREATE POLICY "profile_brands_select_own" ON public.profile_brands
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "profile_brands_insert_own" ON public.profile_brands;
CREATE POLICY "profile_brands_insert_own" ON public.profile_brands
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "profile_brands_update_own" ON public.profile_brands;
CREATE POLICY "profile_brands_update_own" ON public.profile_brands
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "profile_brands_delete_own" ON public.profile_brands;
CREATE POLICY "profile_brands_delete_own" ON public.profile_brands
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "profile_brands_admin_all" ON public.profile_brands;
CREATE POLICY "profile_brands_admin_all" ON public.profile_brands
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- PROFILE_CREATORS
-- =====================================================

DROP POLICY IF EXISTS "profile_creators_select_own" ON public.profile_creators;
CREATE POLICY "profile_creators_select_own" ON public.profile_creators
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "profile_creators_insert_own" ON public.profile_creators;
CREATE POLICY "profile_creators_insert_own" ON public.profile_creators
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "profile_creators_update_own" ON public.profile_creators;
CREATE POLICY "profile_creators_update_own" ON public.profile_creators
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "profile_creators_delete_own" ON public.profile_creators;
CREATE POLICY "profile_creators_delete_own" ON public.profile_creators
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "profile_creators_admin_all" ON public.profile_creators;
CREATE POLICY "profile_creators_admin_all" ON public.profile_creators
  FOR ALL USING (public.is_admin(auth.uid()));

-- Public : lecture seulement des profils créateurs
DROP POLICY IF EXISTS "profile_creators_public_read" ON public.profile_creators;
CREATE POLICY "profile_creators_public_read" ON public.profile_creators
  FOR SELECT USING (true);

-- =====================================================
-- CONTESTS
-- =====================================================

-- Brand : CRUD sur ses concours
DROP POLICY IF EXISTS "contests_brand_manage_own" ON public.contests;
CREATE POLICY "contests_brand_manage_own" ON public.contests
  FOR ALL USING (auth.uid() = brand_id)
  WITH CHECK (auth.uid() = brand_id);

-- Admin : accès complet
DROP POLICY IF EXISTS "contests_admin_all" ON public.contests;
CREATE POLICY "contests_admin_all" ON public.contests
  FOR ALL USING (public.is_admin(auth.uid()));

-- Public : lecture seulement sur les concours actifs
DROP POLICY IF EXISTS "contests_public_read_active" ON public.contests;
CREATE POLICY "contests_public_read_active" ON public.contests
  FOR SELECT USING (status = 'active' AND start_at <= public.now_utc() AND end_at >= public.now_utc());

-- Creator : lecture pour participation
DROP POLICY IF EXISTS "contests_creator_read_for_participation" ON public.contests;
CREATE POLICY "contests_creator_read_for_participation" ON public.contests
  FOR SELECT USING (
    status IN ('active', 'ended') 
    AND start_at <= public.now_utc()
  );

-- =====================================================
-- CONTEST_TERMS
-- =====================================================

-- Public : lecture seulement
DROP POLICY IF EXISTS "contest_terms_public_read" ON public.contest_terms;
CREATE POLICY "contest_terms_public_read" ON public.contest_terms
  FOR SELECT USING (true);

-- Admin : gestion complète
DROP POLICY IF EXISTS "contest_terms_admin_all" ON public.contest_terms;
CREATE POLICY "contest_terms_admin_all" ON public.contest_terms
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- CONTEST_ASSETS
-- =====================================================

-- Brand : gestion des assets de ses concours
DROP POLICY IF EXISTS "contest_assets_brand_manage" ON public.contest_assets;
CREATE POLICY "contest_assets_brand_manage" ON public.contest_assets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.contests c
      WHERE c.id = contest_assets.contest_id
      AND c.brand_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contests c
      WHERE c.id = contest_assets.contest_id
      AND c.brand_id = auth.uid()
    )
  );

-- Admin : accès complet
DROP POLICY IF EXISTS "contest_assets_admin_all" ON public.contest_assets;
CREATE POLICY "contest_assets_admin_all" ON public.contest_assets
  FOR ALL USING (public.is_admin(auth.uid()));

-- Public : lecture seulement des assets des concours actifs
DROP POLICY IF EXISTS "contest_assets_public_read_active" ON public.contest_assets;
CREATE POLICY "contest_assets_public_read_active" ON public.contest_assets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.contests c
      WHERE c.id = contest_assets.contest_id
      AND c.status = 'active'
    )
  );

-- =====================================================
-- SUBMISSIONS
-- =====================================================

-- Creator : CRUD sur ses propres soumissions
DROP POLICY IF EXISTS "submissions_creator_manage_own" ON public.submissions;
CREATE POLICY "submissions_creator_manage_own" ON public.submissions
  FOR ALL USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

-- INSERT: impose une acceptation de CGU pour la bonne version (si définie sur le concours)
DROP POLICY IF EXISTS "submissions_creator_insert_requires_terms" ON public.submissions;
CREATE POLICY "submissions_creator_insert_requires_terms" ON public.submissions
  FOR INSERT
  WITH CHECK (
    auth.uid() = creator_id
    AND (
      EXISTS (
        SELECT 1
        FROM public.contests c
        WHERE c.id = submissions.contest_id
          AND c.contest_terms_id IS NULL
      )
      OR EXISTS (
        SELECT 1
        FROM public.contest_terms_acceptances cta
        JOIN public.contests c ON c.id = submissions.contest_id
        WHERE cta.user_id = auth.uid()
          AND cta.contest_id = submissions.contest_id
          AND c.contest_terms_id IS NOT NULL
          AND cta.contest_terms_id = c.contest_terms_id
      )
    )
  );

-- Brand : lecture des soumissions liées à ses concours
DROP POLICY IF EXISTS "submissions_brand_read_own_contests" ON public.submissions;
CREATE POLICY "submissions_brand_read_own_contests" ON public.submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.contests c
      WHERE c.id = submissions.contest_id
      AND c.brand_id = auth.uid()
    )
  );

-- Admin : accès complet
DROP POLICY IF EXISTS "submissions_admin_all" ON public.submissions;
CREATE POLICY "submissions_admin_all" ON public.submissions
  FOR ALL USING (public.is_admin(auth.uid()));

-- Public : lecture seulement des soumissions approuvées des concours actifs
DROP POLICY IF EXISTS "submissions_public_read_approved_active" ON public.submissions;
CREATE POLICY "submissions_public_read_approved_active" ON public.submissions
  FOR SELECT USING (
    status = 'approved'
    AND EXISTS (
      SELECT 1 FROM public.contests c
      WHERE c.id = submissions.contest_id
      AND c.status = 'active'
    )
  );

-- =====================================================
-- METRICS_DAILY
-- =====================================================

-- Creator : lecture de ses métriques (via submission)
DROP POLICY IF EXISTS "metrics_daily_creator_read_own" ON public.metrics_daily;
CREATE POLICY "metrics_daily_creator_read_own" ON public.metrics_daily
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = metrics_daily.submission_id
      AND s.creator_id = auth.uid()
    )
  );

-- Brand : lecture des métriques des soumissions de ses concours
DROP POLICY IF EXISTS "metrics_daily_brand_read_own_contests" ON public.metrics_daily;
CREATE POLICY "metrics_daily_brand_read_own_contests" ON public.metrics_daily
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      INNER JOIN public.contests c ON c.id = s.contest_id
      WHERE s.id = metrics_daily.submission_id
      AND c.brand_id = auth.uid()
    )
  );

-- Admin : accès complet
DROP POLICY IF EXISTS "metrics_daily_admin_all" ON public.metrics_daily;
CREATE POLICY "metrics_daily_admin_all" ON public.metrics_daily
  FOR ALL USING (public.is_admin(auth.uid()));

-- IMPORTANT : INSERT/UPDATE réservés au service role uniquement (pas de politique RLS pour INSERT/UPDATE)
-- Les métriques sont écrites par des Edge Functions ou cron jobs avec service_role

-- =====================================================
-- PAYMENTS_BRAND
-- =====================================================

-- Brand : CRUD sur ses paiements
DROP POLICY IF EXISTS "payments_brand_brand_manage_own" ON public.payments_brand;
CREATE POLICY "payments_brand_brand_manage_own" ON public.payments_brand
  FOR ALL USING (auth.uid() = brand_id)
  WITH CHECK (auth.uid() = brand_id);

-- Admin : accès complet
DROP POLICY IF EXISTS "payments_brand_admin_all" ON public.payments_brand;
CREATE POLICY "payments_brand_admin_all" ON public.payments_brand
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- CASHOUTS
-- =====================================================

-- Creator : CRUD sur ses propres cashouts
DROP POLICY IF EXISTS "cashouts_creator_manage_own" ON public.cashouts;
CREATE POLICY "cashouts_creator_manage_own" ON public.cashouts
  FOR ALL USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

-- Admin : accès complet
DROP POLICY IF EXISTS "cashouts_admin_all" ON public.cashouts;
CREATE POLICY "cashouts_admin_all" ON public.cashouts
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- WEBHOOKS_STRIPE
-- =====================================================

-- Admin : accès complet uniquement
DROP POLICY IF EXISTS "webhooks_stripe_admin_all" ON public.webhooks_stripe;
CREATE POLICY "webhooks_stripe_admin_all" ON public.webhooks_stripe
  FOR ALL USING (public.is_admin(auth.uid()));

-- IMPORTANT : INSERT réservé au service role pour les webhooks Stripe

-- =====================================================
-- MODERATION_QUEUE
-- =====================================================

-- Admin : accès complet
DROP POLICY IF EXISTS "moderation_queue_admin_all" ON public.moderation_queue;
CREATE POLICY "moderation_queue_admin_all" ON public.moderation_queue
  FOR ALL USING (public.is_admin(auth.uid()));

-- Brand : lecture seulement pour les soumissions de ses concours
DROP POLICY IF EXISTS "moderation_queue_brand_read_own_contests" ON public.moderation_queue;
CREATE POLICY "moderation_queue_brand_read_own_contests" ON public.moderation_queue
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      INNER JOIN public.contests c ON c.id = s.contest_id
      WHERE s.id = moderation_queue.submission_id
      AND c.brand_id = auth.uid()
    )
  );

-- Creator : lecture seulement de ses propres soumissions
DROP POLICY IF EXISTS "moderation_queue_creator_read_own" ON public.moderation_queue;
CREATE POLICY "moderation_queue_creator_read_own" ON public.moderation_queue
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = moderation_queue.submission_id
      AND s.creator_id = auth.uid()
    )
  );

-- =====================================================
-- MODERATION_RULES
-- =====================================================

-- Admin : accès complet uniquement
DROP POLICY IF EXISTS "moderation_rules_admin_all" ON public.moderation_rules;
CREATE POLICY "moderation_rules_admin_all" ON public.moderation_rules
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- AUDIT_LOGS
-- =====================================================

-- Admin : accès complet uniquement
DROP POLICY IF EXISTS "audit_logs_admin_all" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_all" ON public.audit_logs
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- MESSAGES_THREADS
-- =====================================================

-- Brand et Creator : CRUD sur leurs threads
DROP POLICY IF EXISTS "messages_threads_participants_manage" ON public.messages_threads;
CREATE POLICY "messages_threads_participants_manage" ON public.messages_threads
  FOR ALL USING (auth.uid() = brand_id OR auth.uid() = creator_id)
  WITH CHECK (auth.uid() = brand_id OR auth.uid() = creator_id);

-- Admin : accès complet
DROP POLICY IF EXISTS "messages_threads_admin_all" ON public.messages_threads;
CREATE POLICY "messages_threads_admin_all" ON public.messages_threads
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- MESSAGES
-- =====================================================

-- Participants du thread : CRUD sur les messages de leurs threads
DROP POLICY IF EXISTS "messages_participants_manage" ON public.messages;
CREATE POLICY "messages_participants_manage" ON public.messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.messages_threads mt
      WHERE mt.id = messages.thread_id
      AND (mt.brand_id = auth.uid() OR mt.creator_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.messages_threads mt
      WHERE mt.id = messages.thread_id
      AND (mt.brand_id = auth.uid() OR mt.creator_id = auth.uid())
    )
  );

-- Admin : accès complet
DROP POLICY IF EXISTS "messages_admin_all" ON public.messages;
CREATE POLICY "messages_admin_all" ON public.messages
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- NOTIFICATIONS
-- =====================================================

-- User : CRUD sur ses propres notifications
DROP POLICY IF EXISTS "notifications_user_manage_own" ON public.notifications;
CREATE POLICY "notifications_user_manage_own" ON public.notifications
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin : accès complet
DROP POLICY IF EXISTS "notifications_admin_all" ON public.notifications;
CREATE POLICY "notifications_admin_all" ON public.notifications
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- ORGS
-- =====================================================

-- Membres de l'org + admin : gestion complète
DROP POLICY IF EXISTS "orgs_members_manage" ON public.orgs;
CREATE POLICY "orgs_members_manage" ON public.orgs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = orgs.id
      AND user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = orgs.id
      AND user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );

-- =====================================================
-- ORG_MEMBERS
-- =====================================================

-- Membres de l'org + admin : lecture
DROP POLICY IF EXISTS "org_members_read_own_org" ON public.org_members;
CREATE POLICY "org_members_read_own_org" ON public.org_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = org_members.org_id
      AND om.user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );

-- Owner : gestion des membres
DROP POLICY IF EXISTS "org_members_owner_manage" ON public.org_members;
CREATE POLICY "org_members_owner_manage" ON public.org_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = org_members.org_id
      AND om.user_id = auth.uid()
      AND om.role_in_org = 'owner'
    )
    OR public.is_admin(auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = org_members.org_id
      AND om.user_id = auth.uid()
      AND om.role_in_org = 'owner'
    )
    OR public.is_admin(auth.uid())
  );

-- =====================================================
-- PLATFORM_ACCOUNTS
-- =====================================================

-- Propriétaire : CRUD sur ses comptes
DROP POLICY IF EXISTS "platform_accounts_owner_manage" ON public.platform_accounts;
CREATE POLICY "platform_accounts_owner_manage" ON public.platform_accounts
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin : accès complet
DROP POLICY IF EXISTS "platform_accounts_admin_all" ON public.platform_accounts;
CREATE POLICY "platform_accounts_admin_all" ON public.platform_accounts
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- PLATFORM_OAUTH_TOKENS
-- =====================================================

-- Propriétaire : lecture seulement
DROP POLICY IF EXISTS "platform_oauth_tokens_owner_read" ON public.platform_oauth_tokens;
CREATE POLICY "platform_oauth_tokens_owner_read" ON public.platform_oauth_tokens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.platform_accounts pa
      WHERE pa.id = platform_oauth_tokens.account_id
      AND pa.user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );

-- IMPORTANT : INSERT/UPDATE réservés au service_role uniquement
-- Pas de politique publique pour INSERT/UPDATE

-- =====================================================
-- INGESTION_JOBS
-- =====================================================

-- Propriétaire du compte : lecture
DROP POLICY IF EXISTS "ingestion_jobs_owner_read" ON public.ingestion_jobs;
CREATE POLICY "ingestion_jobs_owner_read" ON public.ingestion_jobs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.platform_accounts pa
      WHERE pa.id = ingestion_jobs.account_id
      AND pa.user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );

-- Service role : gestion complète
-- Pas de politique publique pour INSERT/UPDATE

-- =====================================================
-- INGESTION_ERRORS
-- =====================================================

-- Propriétaire du compte (via job) : lecture
DROP POLICY IF EXISTS "ingestion_errors_owner_read" ON public.ingestion_errors;
CREATE POLICY "ingestion_errors_owner_read" ON public.ingestion_errors
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ingestion_jobs ij
      INNER JOIN public.platform_accounts pa ON pa.id = ij.account_id
      WHERE ij.id = ingestion_errors.job_id
      AND pa.user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );

-- =====================================================
-- NOTIFICATION_PREFERENCES
-- =====================================================

-- Propriétaire : CRUD
DROP POLICY IF EXISTS "notification_preferences_owner_manage" ON public.notification_preferences;
CREATE POLICY "notification_preferences_owner_manage" ON public.notification_preferences
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin : accès complet
DROP POLICY IF EXISTS "notification_preferences_admin_all" ON public.notification_preferences;
CREATE POLICY "notification_preferences_admin_all" ON public.notification_preferences
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- PUSH_TOKENS
-- =====================================================

-- Propriétaire : CRUD
DROP POLICY IF EXISTS "push_tokens_owner_manage" ON public.push_tokens;
CREATE POLICY "push_tokens_owner_manage" ON public.push_tokens
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin : accès complet
DROP POLICY IF EXISTS "push_tokens_admin_all" ON public.push_tokens;
CREATE POLICY "push_tokens_admin_all" ON public.push_tokens
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- INVOICES
-- =====================================================

-- Membres de l'org (rôles admin/finance) + admin : gestion
DROP POLICY IF EXISTS "invoices_org_members_manage" ON public.invoices;
CREATE POLICY "invoices_org_members_manage" ON public.invoices
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = invoices.org_id
      AND om.user_id = auth.uid()
      AND om.role_in_org IN ('owner', 'admin', 'finance')
    )
    OR public.is_admin(auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = invoices.org_id
      AND om.user_id = auth.uid()
      AND om.role_in_org IN ('owner', 'admin', 'finance')
    )
    OR public.is_admin(auth.uid())
  );

-- Membres de l'org (lecture) : lecture
DROP POLICY IF EXISTS "invoices_org_members_read" ON public.invoices;
CREATE POLICY "invoices_org_members_read" ON public.invoices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = invoices.org_id
      AND om.user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );

-- =====================================================
-- TAX_EVIDENCE
-- =====================================================

-- Membres de l'org + admin : gestion
DROP POLICY IF EXISTS "tax_evidence_org_members_manage" ON public.tax_evidence;
CREATE POLICY "tax_evidence_org_members_manage" ON public.tax_evidence
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = tax_evidence.org_id
      AND om.user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = tax_evidence.org_id
      AND om.user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );

-- =====================================================
-- KYC_CHECKS
-- =====================================================

-- Propriétaire : lecture
DROP POLICY IF EXISTS "kyc_checks_owner_read" ON public.kyc_checks;
CREATE POLICY "kyc_checks_owner_read" ON public.kyc_checks
  FOR SELECT USING (auth.uid() = user_id);

-- Admin : gestion complète
DROP POLICY IF EXISTS "kyc_checks_admin_all" ON public.kyc_checks;
CREATE POLICY "kyc_checks_admin_all" ON public.kyc_checks
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- RISK_FLAGS
-- =====================================================

-- Propriétaire : lecture
DROP POLICY IF EXISTS "risk_flags_owner_read" ON public.risk_flags;
CREATE POLICY "risk_flags_owner_read" ON public.risk_flags
  FOR SELECT USING (auth.uid() = user_id);

-- Admin : gestion complète
DROP POLICY IF EXISTS "risk_flags_admin_all" ON public.risk_flags;
CREATE POLICY "risk_flags_admin_all" ON public.risk_flags
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- ASSETS
-- =====================================================

-- Propriétaire (owner_id) : CRUD
DROP POLICY IF EXISTS "assets_owner_manage" ON public.assets;
CREATE POLICY "assets_owner_manage" ON public.assets
  FOR ALL USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Membres de l'org : CRUD
DROP POLICY IF EXISTS "assets_org_members_manage" ON public.assets;
CREATE POLICY "assets_org_members_manage" ON public.assets
  FOR ALL USING (
    org_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = assets.org_id
      AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = assets.org_id
      AND om.user_id = auth.uid()
    )
  );

-- Public : lecture seulement si visibility='public'
DROP POLICY IF EXISTS "assets_public_read_public" ON public.assets;
CREATE POLICY "assets_public_read_public" ON public.assets
  FOR SELECT USING (visibility = 'public');

-- Admin : accès complet
DROP POLICY IF EXISTS "assets_admin_all" ON public.assets;
CREATE POLICY "assets_admin_all" ON public.assets
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- MODERATION_ACTIONS
-- =====================================================

-- Admin only : accès complet
DROP POLICY IF EXISTS "moderation_actions_admin_all" ON public.moderation_actions;
CREATE POLICY "moderation_actions_admin_all" ON public.moderation_actions
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- WEBHOOK_ENDPOINTS
-- =====================================================

-- Membres de l'org + admin : gestion
DROP POLICY IF EXISTS "webhook_endpoints_org_members_manage" ON public.webhook_endpoints;
CREATE POLICY "webhook_endpoints_org_members_manage" ON public.webhook_endpoints
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = webhook_endpoints.org_id
      AND om.user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = webhook_endpoints.org_id
      AND om.user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );

-- =====================================================
-- WEBHOOK_DELIVERIES
-- =====================================================

-- Membres de l'org (via endpoint) + admin : lecture
DROP POLICY IF EXISTS "webhook_deliveries_org_members_read" ON public.webhook_deliveries;
CREATE POLICY "webhook_deliveries_org_members_read" ON public.webhook_deliveries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.webhook_endpoints we
      INNER JOIN public.org_members om ON om.org_id = we.org_id
      WHERE we.id = webhook_deliveries.endpoint_id
      AND om.user_id = auth.uid()
    )
    OR public.is_admin(auth.uid())
  );

-- Service role : INSERT uniquement
-- Pas de politique publique pour INSERT

-- =====================================================
-- EVENT_LOG
-- =====================================================

-- User : lecture de ses propres événements
DROP POLICY IF EXISTS "event_log_user_read_own" ON public.event_log;
CREATE POLICY "event_log_user_read_own" ON public.event_log
  FOR SELECT USING (auth.uid() = user_id);

-- Membres de l'org : lecture des événements de l'org
DROP POLICY IF EXISTS "event_log_org_members_read" ON public.event_log;
CREATE POLICY "event_log_org_members_read" ON public.event_log
  FOR SELECT USING (
    org_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = event_log.org_id
      AND om.user_id = auth.uid()
    )
  );

-- Admin : accès complet
DROP POLICY IF EXISTS "event_log_admin_all" ON public.event_log;
CREATE POLICY "event_log_admin_all" ON public.event_log
  FOR ALL USING (public.is_admin(auth.uid()));

-- Service role : INSERT uniquement
-- Pas de politique publique pour INSERT

-- =====================================================
-- CONTEST_PRIZES
-- =====================================================

-- Brand : gestion des prix de ses concours
DROP POLICY IF EXISTS "contest_prizes_brand_manage" ON public.contest_prizes;
CREATE POLICY "contest_prizes_brand_manage" ON public.contest_prizes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.contests c
      WHERE c.id = contest_prizes.contest_id
      AND c.brand_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contests c
      WHERE c.id = contest_prizes.contest_id
      AND c.brand_id = auth.uid()
    )
  );

-- Admin : accès complet
DROP POLICY IF EXISTS "contest_prizes_admin_all" ON public.contest_prizes;
CREATE POLICY "contest_prizes_admin_all" ON public.contest_prizes
  FOR ALL USING (public.is_admin(auth.uid()));

-- Public : lecture seulement pour concours actifs
DROP POLICY IF EXISTS "contest_prizes_public_read_active" ON public.contest_prizes;
CREATE POLICY "contest_prizes_public_read_active" ON public.contest_prizes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.contests c
      WHERE c.id = contest_prizes.contest_id
      AND c.status = 'active'
    )
  );

-- =====================================================
-- CONTEST_WINNINGS
-- =====================================================

-- Creator : lecture de ses propres gains
DROP POLICY IF EXISTS "contest_winnings_creator_read_own" ON public.contest_winnings;
CREATE POLICY "contest_winnings_creator_read_own" ON public.contest_winnings
  FOR SELECT USING (auth.uid() = creator_id);

-- Brand : lecture des gains de ses concours
DROP POLICY IF EXISTS "contest_winnings_brand_read_own_contests" ON public.contest_winnings;
CREATE POLICY "contest_winnings_brand_read_own_contests" ON public.contest_winnings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.contests c
      WHERE c.id = contest_winnings.contest_id
      AND c.brand_id = auth.uid()
    )
  );

-- Admin : accès complet
DROP POLICY IF EXISTS "contest_winnings_admin_all" ON public.contest_winnings;
CREATE POLICY "contest_winnings_admin_all" ON public.contest_winnings
  FOR ALL USING (public.is_admin(auth.uid()));

-- Service role : INSERT/UPDATE pour calcul automatique
-- Pas de politique publique pour INSERT/UPDATE

-- =====================================================
-- CONTEST_TERMS_ACCEPTANCES
-- =====================================================

-- User : lecture de ses propres acceptations
DROP POLICY IF EXISTS "contest_terms_acceptances_user_read_own" ON public.contest_terms_acceptances;
CREATE POLICY "contest_terms_acceptances_user_read_own" ON public.contest_terms_acceptances
  FOR SELECT USING (auth.uid() = user_id);

-- User : insertion de ses propres acceptations
DROP POLICY IF EXISTS "contest_terms_acceptances_user_insert_own" ON public.contest_terms_acceptances;
CREATE POLICY "contest_terms_acceptances_user_insert_own" ON public.contest_terms_acceptances
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Brand : lecture des acceptations de ses concours
DROP POLICY IF EXISTS "contest_terms_acceptances_brand_read_own_contests" ON public.contest_terms_acceptances;
CREATE POLICY "contest_terms_acceptances_brand_read_own_contests" ON public.contest_terms_acceptances
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.contests c
      WHERE c.id = contest_terms_acceptances.contest_id
      AND c.brand_id = auth.uid()
    )
  );

-- Admin : accès complet
DROP POLICY IF EXISTS "contest_terms_acceptances_admin_all" ON public.contest_terms_acceptances;
CREATE POLICY "contest_terms_acceptances_admin_all" ON public.contest_terms_acceptances
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- FOLLOWS
-- =====================================================

-- User : CRUD sur ses propres follows
DROP POLICY IF EXISTS "follows_user_manage" ON public.follows;
CREATE POLICY "follows_user_manage" ON public.follows
  FOR ALL USING (auth.uid() = follower_id)
  WITH CHECK (auth.uid() = follower_id);

-- Public : lecture seulement (pour voir qui suit qui)
DROP POLICY IF EXISTS "follows_public_read" ON public.follows;
CREATE POLICY "follows_public_read" ON public.follows
  FOR SELECT USING (true);

-- =====================================================
-- CONTEST_FAVORITES
-- =====================================================

-- User : CRUD sur ses propres favoris
DROP POLICY IF EXISTS "contest_favorites_user_manage" ON public.contest_favorites;
CREATE POLICY "contest_favorites_user_manage" ON public.contest_favorites
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- CONTEST_TAGS
-- =====================================================

-- Public : lecture seulement
DROP POLICY IF EXISTS "contest_tags_public_read" ON public.contest_tags;
CREATE POLICY "contest_tags_public_read" ON public.contest_tags
  FOR SELECT USING (is_active = true);

-- Admin : gestion complète
DROP POLICY IF EXISTS "contest_tags_admin_all" ON public.contest_tags;
CREATE POLICY "contest_tags_admin_all" ON public.contest_tags
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- CONTEST_TAG_LINKS
-- =====================================================

-- Brand : gestion des tags de ses concours
DROP POLICY IF EXISTS "contest_tag_links_brand_manage" ON public.contest_tag_links;
CREATE POLICY "contest_tag_links_brand_manage" ON public.contest_tag_links
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.contests c
      WHERE c.id = contest_tag_links.contest_id
      AND c.brand_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.contests c
      WHERE c.id = contest_tag_links.contest_id
      AND c.brand_id = auth.uid()
    )
  );

-- Public : lecture seulement
DROP POLICY IF EXISTS "contest_tag_links_public_read" ON public.contest_tag_links;
CREATE POLICY "contest_tag_links_public_read" ON public.contest_tag_links
  FOR SELECT USING (true);

-- =====================================================
-- STATUS_HISTORY
-- =====================================================

-- User : lecture de l'historique de ses propres entités
DROP POLICY IF EXISTS "status_history_user_read_own" ON public.status_history;
CREATE POLICY "status_history_user_read_own" ON public.status_history
  FOR SELECT USING (
    (table_name = 'submissions' AND EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = status_history.row_id AND s.creator_id = auth.uid()
    ))
    OR (table_name = 'contests' AND EXISTS (
      SELECT 1 FROM public.contests c
      WHERE c.id = status_history.row_id AND c.brand_id = auth.uid()
    ))
    OR (table_name = 'cashouts' AND EXISTS (
      SELECT 1 FROM public.cashouts c
      WHERE c.id = status_history.row_id AND c.creator_id = auth.uid()
    ))
  );

-- Admin : accès complet
DROP POLICY IF EXISTS "status_history_admin_all" ON public.status_history;
CREATE POLICY "status_history_admin_all" ON public.status_history
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- SUBMISSION_COMMENTS
-- =====================================================

-- Participants : CRUD sur les commentaires de leurs soumissions
DROP POLICY IF EXISTS "submission_comments_participants_manage" ON public.submission_comments;
CREATE POLICY "submission_comments_participants_manage" ON public.submission_comments
  FOR ALL USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = submission_comments.submission_id
      AND (s.creator_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.contests c
        WHERE c.id = s.contest_id AND c.brand_id = auth.uid()
      ))
    )
  )
  WITH CHECK (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.id = submission_comments.submission_id
      AND (s.creator_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.contests c
        WHERE c.id = s.contest_id AND c.brand_id = auth.uid()
      ))
    )
  );

-- Admin : accès complet
DROP POLICY IF EXISTS "submission_comments_admin_all" ON public.submission_comments;
CREATE POLICY "submission_comments_admin_all" ON public.submission_comments
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- NOTIFICATION_TEMPLATES
-- =====================================================

-- Admin : accès complet uniquement
DROP POLICY IF EXISTS "notification_templates_admin_all" ON public.notification_templates;
CREATE POLICY "notification_templates_admin_all" ON public.notification_templates
  FOR ALL USING (public.is_admin(auth.uid()));

-- =====================================================
-- COMMENTAIRES
-- =====================================================

COMMENT ON POLICY "profiles_select_own" ON public.profiles IS 'Créateur peut lire son propre profil';
COMMENT ON POLICY "contests_public_read_active" ON public.contests IS 'Public peut lire les concours actifs';
COMMENT ON POLICY "metrics_daily_creator_read_own" ON public.metrics_daily IS 'Créateur peut lire ses métriques';
COMMENT ON POLICY "orgs_members_manage" ON public.orgs IS 'Membres de l''org peuvent gérer leur organisation';
COMMENT ON POLICY "assets_public_read_public" ON public.assets IS 'Assets publics sont lisibles sans auth';
COMMENT ON POLICY "moderation_actions_admin_all" ON public.moderation_actions IS 'Historique modération: admin only';
