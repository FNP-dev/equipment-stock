-- Nadaj rolę Admin użytkownikowi doe@ii.io

DO $$
DECLARE
  admin_role_id UUID;
  target_user_id UUID;
BEGIN
  -- Pobierz ID roli Admin
  SELECT id INTO admin_role_id FROM roles WHERE name = 'Admin' LIMIT 1;
  
  -- Pobierz ID użytkownika
  SELECT id INTO target_user_id FROM auth.users WHERE email = 'doe@ii.io' LIMIT 1;
  
  IF target_user_id IS NOT NULL AND admin_role_id IS NOT NULL THEN
    -- Usuń istniejący profil jeśli istnieje
    DELETE FROM user_profiles WHERE user_profiles.user_id = target_user_id;
    
    -- Wstaw nowy profil z rolą Admin
    INSERT INTO user_profiles (user_id, role_id, is_active)
    VALUES (target_user_id, admin_role_id, true);
    
    RAISE NOTICE 'Nadano rolę Admin użytkownikowi doe@ii.io';
  ELSE
    RAISE NOTICE 'Nie znaleziono użytkownika lub roli';
  END IF;
END $$;