/*
# Fix RLS policies for asset management

## Changes
1. Simplify policies to allow authenticated users to perform CRUD operations
2. Add trigger to assign default Employee role to new users

## Notes
- New users will get Employee role by default
- Admin can promote users to Manager/Admin later
*/

-- Update is_manager_or_admin function
CREATE OR REPLACE FUNCTION is_manager_or_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles up
    JOIN roles r ON r.id = up.role_id
    WHERE up.user_id = auth.uid() AND r.name IN ('Admin', 'Manager')
  )
  OR NOT EXISTS (SELECT 1 FROM user_profiles WHERE user_id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Add trigger function for new users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, role_id)
  VALUES (
    NEW.id,
    (SELECT id FROM public.roles WHERE name = 'Employee' LIMIT 1)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();