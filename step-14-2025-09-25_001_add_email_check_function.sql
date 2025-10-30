-- Migration pour ajouter une fonction de vérification d'email
-- Cette fonction permet de vérifier si un email existe dans auth.users

-- Créer une fonction pour vérifier l'existence d'un email
CREATE OR REPLACE FUNCTION check_email_exists(email_to_check TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Vérifier si l'email existe dans auth.users
  RETURN EXISTS (
    SELECT 1 
    FROM auth.users 
    WHERE email = email_to_check
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Donner les permissions nécessaires
GRANT EXECUTE ON FUNCTION check_email_exists(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION check_email_exists(TEXT) TO anon;

-- Commenter la fonction
COMMENT ON FUNCTION check_email_exists(TEXT) IS 'Vérifie si un email existe dans auth.users';
