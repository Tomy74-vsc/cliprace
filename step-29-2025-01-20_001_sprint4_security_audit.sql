-- Sprint 4: Audit et amélioration de la sécurité RLS
-- Vérification et renforcement des politiques de sécurité

-- 1. Audit des politiques RLS existantes
-- Vérifier que toutes les tables ont RLS activé
DO $$
DECLARE
    table_name TEXT;
    rls_enabled BOOLEAN;
BEGIN
    FOR table_name IN 
        SELECT schemaname||'.'||tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT LIKE 'pg_%'
    LOOP
        SELECT relrowsecurity INTO rls_enabled
        FROM pg_class 
        WHERE relname = split_part(table_name, '.', 2);
        
        IF NOT rls_enabled THEN
            RAISE NOTICE 'Table % n''a pas RLS activé', table_name;
        END IF;
    END LOOP;
END $$;

-- 2. Amélioration des politiques de sécurité pour les profils
-- Supprimer les anciennes politiques pour les recréer avec plus de sécurité
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON profiles;
DROP POLICY IF EXISTS "Public can view verified profiles" ON profiles;

-- Politiques renforcées pour les profils
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (
    auth.uid() = id 
    AND auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id 
    AND auth.uid() IS NOT NULL
    AND email = auth.jwt() ->> 'email'
    AND role IN ('creator', 'brand')
  );

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (
    auth.uid() = id 
    AND auth.uid() IS NOT NULL
  ) WITH CHECK (
    auth.uid() = id 
    AND email = auth.jwt() ->> 'email'
  );

DROP POLICY IF EXISTS "Users can delete their own profile" ON profiles;
CREATE POLICY "Users can delete their own profile" ON profiles
  FOR DELETE USING (
    auth.uid() = id 
    AND auth.uid() IS NOT NULL
  );

-- Politique publique plus restrictive pour les profils vérifiés
DROP POLICY IF EXISTS "Public can view verified profiles" ON profiles;
CREATE POLICY "Public can view verified profiles" ON profiles
  FOR SELECT USING (
    is_verified = TRUE 
    AND is_active = TRUE
    AND auth.uid() IS NOT NULL
  );

-- 3. Politiques renforcées pour les profils créateurs
DROP POLICY IF EXISTS "Users can view their own creator profile" ON profiles_creator;
DROP POLICY IF EXISTS "Users can insert their own creator profile" ON profiles_creator;
DROP POLICY IF EXISTS "Users can update their own creator profile" ON profiles_creator;
DROP POLICY IF EXISTS "Users can delete their own creator profile" ON profiles_creator;
DROP POLICY IF EXISTS "Public can view creator profiles" ON profiles_creator;

DROP POLICY IF EXISTS "Users can view their own creator profile" ON profiles_creator;
CREATE POLICY "Users can view their own creator profile" ON profiles_creator
  FOR SELECT USING (
    auth.uid() = user_id 
    AND auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "Users can insert their own creator profile" ON profiles_creator;
CREATE POLICY "Users can insert their own creator profile" ON profiles_creator
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'creator'
    )
  );

DROP POLICY IF EXISTS "Users can update their own creator profile" ON profiles_creator;
CREATE POLICY "Users can update their own creator profile" ON profiles_creator
  FOR UPDATE USING (
    auth.uid() = user_id 
    AND auth.uid() IS NOT NULL
  ) WITH CHECK (
    auth.uid() = user_id
  );

DROP POLICY IF EXISTS "Users can delete their own creator profile" ON profiles_creator;
CREATE POLICY "Users can delete their own creator profile" ON profiles_creator
  FOR DELETE USING (
    auth.uid() = user_id 
    AND auth.uid() IS NOT NULL
  );

-- Politique publique pour les profils créateurs (lecture seule)
DROP POLICY IF EXISTS "Public can view creator profiles" ON profiles_creator;
CREATE POLICY "Public can view creator profiles" ON profiles_creator
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = user_id 
      AND is_verified = TRUE 
      AND is_active = TRUE
    )
  );

-- 4. Politiques renforcées pour les profils marques
DROP POLICY IF EXISTS "Users can view their own brand profile" ON profiles_brand;
DROP POLICY IF EXISTS "Users can insert their own brand profile" ON profiles_brand;
DROP POLICY IF EXISTS "Users can update their own brand profile" ON profiles_brand;
DROP POLICY IF EXISTS "Users can delete their own brand profile" ON profiles_brand;
DROP POLICY IF EXISTS "Public can view brand profiles" ON profiles_brand;

DROP POLICY IF EXISTS "Users can view their own brand profile" ON profiles_brand;
CREATE POLICY "Users can view their own brand profile" ON profiles_brand
  FOR SELECT USING (
    auth.uid() = user_id 
    AND auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "Users can insert their own brand profile" ON profiles_brand;
CREATE POLICY "Users can insert their own brand profile" ON profiles_brand
  FOR INSERT WITH CHECK (
    auth.uid() = user_id 
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'brand'
    )
  );

DROP POLICY IF EXISTS "Users can update their own brand profile" ON profiles_brand;
CREATE POLICY "Users can update their own brand profile" ON profiles_brand
  FOR UPDATE USING (
    auth.uid() = user_id 
    AND auth.uid() IS NOT NULL
  ) WITH CHECK (
    auth.uid() = user_id
  );

DROP POLICY IF EXISTS "Users can delete their own brand profile" ON profiles_brand;
CREATE POLICY "Users can delete their own brand profile" ON profiles_brand
  FOR DELETE USING (
    auth.uid() = user_id 
    AND auth.uid() IS NOT NULL
  );

-- Politique publique pour les profils marques (lecture seule)
DROP POLICY IF EXISTS "Public can view brand profiles" ON profiles_brand;
CREATE POLICY "Public can view brand profiles" ON profiles_brand
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = user_id 
      AND is_verified = TRUE 
      AND is_active = TRUE
    )
  );

-- 5. Fonction de sécurité pour vérifier l'intégrité des données
CREATE OR REPLACE FUNCTION validate_user_data_integrity()
RETURNS TRIGGER AS $$
BEGIN
  -- Vérifier que l'utilisateur existe dans auth.users
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'User does not exist in auth.users';
  END IF;
  
  -- Vérifier que l'email correspond
  IF auth.uid() != (SELECT email FROM auth.users WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Email mismatch with auth.users';
  END IF;
  
  -- Vérifier que le rôle est valide
  IF auth.uid() NOT IN ('creator', 'brand') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Appliquer le trigger sur la table profiles
DROP TRIGGER IF EXISTS validate_profiles_data_integrity ON profiles;
CREATE TRIGGER validate_profiles_data_integrity
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION validate_user_data_integrity();

-- 6. Fonction pour auditer les accès
CREATE OR REPLACE FUNCTION audit_table_access(
  p_table_name TEXT,
  p_operation TEXT,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO audit_logs (actor_id, action, entity, entity_id, data)
  VALUES (
    p_user_id,
    p_operation::audit_action,
    p_table_name,
    NULL,
    jsonb_build_object(
      'timestamp', NOW(),
      'operation', p_operation,
      'table', p_table_name
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Fonction pour vérifier les permissions d'admin
CREATE OR REPLACE FUNCTION check_admin_permissions(
  p_required_permission TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  is_admin BOOLEAN;
  user_permissions JSONB;
BEGIN
  -- Vérifier si l'utilisateur est admin
  SELECT EXISTS (
    SELECT 1 FROM admins 
    WHERE user_id = auth.uid()
  ) INTO is_admin;
  
  IF NOT is_admin THEN
    RETURN FALSE;
  END IF;
  
  -- Si une permission spécifique est requise
  IF p_required_permission IS NOT NULL THEN
    SELECT permissions INTO user_permissions
    FROM admins 
    WHERE user_id = auth.uid();
    
    -- Vérifier si la permission est accordée
    RETURN COALESCE((user_permissions ->> p_required_permission)::BOOLEAN, FALSE);
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Politiques renforcées pour les admins
DROP POLICY IF EXISTS "Admins can view all admins" ON admins;
DROP POLICY IF EXISTS "Super admins can manage admins" ON admins;

DROP POLICY IF EXISTS "Admins can view all admins" ON admins;
CREATE POLICY "Admins can view all admins" ON admins
  FOR SELECT USING (
    check_admin_permissions()
  );

DROP POLICY IF EXISTS "Super admins can manage admins" ON admins;
CREATE POLICY "Super admins can manage admins" ON admins
  FOR ALL USING (
    check_admin_permissions('manage_admins')
  );

-- 9. Politiques renforcées pour les logs d'audit
DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;

DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;
CREATE POLICY "Admins can view audit logs" ON audit_logs
  FOR SELECT USING (
    check_admin_permissions('view_audit_logs')
  );

-- 10. Fonction pour nettoyer les données sensibles
CREATE OR REPLACE FUNCTION sanitize_user_data(data JSONB)
RETURNS JSONB AS $$
DECLARE
  sanitized JSONB;
BEGIN
  sanitized := data;
  
  -- Supprimer les champs sensibles
  sanitized := sanitized - 'password';
  sanitized := sanitized - 'token';
  sanitized := sanitized - 'secret';
  
  -- Masquer les emails partiellement
  IF sanitized ? 'email' THEN
    sanitized := jsonb_set(
      sanitized, 
      '{email}', 
      to_jsonb(
        regexp_replace(
          sanitized ->> 'email', 
          '^(.{2}).*(@.*)$', 
          '\1***\2'
        )
      )
    );
  END IF;
  
  RETURN sanitized;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Vue sécurisée pour les statistiques publiques
CREATE OR REPLACE VIEW public_stats AS
SELECT 
  (SELECT COUNT(*) FROM profiles WHERE role = 'creator' AND is_active = TRUE) as total_creators,
  (SELECT COUNT(*) FROM profiles WHERE role = 'brand' AND is_active = TRUE) as total_brands,
  (SELECT COUNT(*) FROM contests WHERE status = 'active') as active_contests,
  (SELECT COUNT(*) FROM submissions WHERE status = 'approved') as approved_submissions;

-- Note: Les vues n'ont pas besoin de politiques RLS car elles héritent des permissions des tables sous-jacentes

-- 12. Index pour améliorer les performances des requêtes de sécurité
CREATE INDEX IF NOT EXISTS idx_profiles_auth_uid ON profiles(id) WHERE id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_role_active ON profiles(role, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_timestamp ON audit_logs(actor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_admins_user_id_active ON admins(user_id) WHERE user_id IS NOT NULL;

-- 13. Commentaires pour la documentation
COMMENT ON FUNCTION validate_user_data_integrity() IS 'Valide l''intégrité des données utilisateur avant insertion/mise à jour';
COMMENT ON FUNCTION audit_table_access(TEXT, TEXT, UUID) IS 'Enregistre les accès aux tables pour audit';
COMMENT ON FUNCTION check_admin_permissions(TEXT) IS 'Vérifie les permissions d''administrateur';
COMMENT ON FUNCTION sanitize_user_data(JSONB) IS 'Nettoie les données sensibles des utilisateurs';
COMMENT ON VIEW public_stats IS 'Statistiques publiques sécurisées de la plateforme';

-- 14. Test de sécurité final
DO $$
DECLARE
    test_result TEXT;
BEGIN
    -- Vérifier que RLS est activé sur toutes les tables importantes
    SELECT CASE 
        WHEN COUNT(*) = 0 THEN 'PASS'
        ELSE 'FAIL: ' || string_agg(tablename, ', ')
    END INTO test_result
    FROM pg_tables t
    LEFT JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public' 
    AND t.tablename IN ('profiles', 'profiles_creator', 'profiles_brand', 'admins', 'audit_logs')
    AND (c.relrowsecurity = FALSE OR c.relrowsecurity IS NULL);
    
    RAISE NOTICE 'RLS Security Test: %', test_result;
END $$;
