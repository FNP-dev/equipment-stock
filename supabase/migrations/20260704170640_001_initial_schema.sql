/*
# Initial Asset Management Schema

This migration creates the complete database structure for the Asset Management system.

## Tables Created

1. **roles** - User role definitions (Admin, Manager, Employee)
2. **user_profiles** - Extended user information linked to auth.users
3. **categories** - Asset categories (Laptop, Monitor, Phone, etc.)
4. **locations** - Company locations (Warsaw, Krakow, etc.)
5. **statuses** - Asset status definitions (Available, Assigned, In Service, etc.)
6. **employees** - Company employees who can be assigned assets
7. **assets** - Main asset inventory with all equipment data
8. **asset_history** - Complete audit trail of all asset changes

## Security

- RLS enabled on all tables
- Authenticated users can read all data
- Write operations restricted based on user roles
- Asset history is append-only (no updates/deletes)

## Notes

1. All tables use UUID primary keys with gen_random_uuid()
2. All tables have created_at and updated_at timestamps
3. created_by tracks who created each record
4. Foreign key constraints maintain referential integrity
5. Indexes added for frequently queried columns
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ROLES TABLE
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  permissions jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. USER_PROFILES TABLE (extends auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid REFERENCES roles(id) ON DELETE SET NULL,
  first_name text,
  last_name text,
  phone text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- 3. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon text,
  color text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- 4. LOCATIONS TABLE
CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  city text,
  country text DEFAULT 'Poland',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- 5. STATUSES TABLE
CREATE TABLE IF NOT EXISTS statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- 6. EMPLOYEES TABLE
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text UNIQUE,
  phone text,
  department text,
  position text,
  location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- 7. ASSETS TABLE
CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  manufacturer text,
  model text,
  serial_number text,
  asset_tag text UNIQUE,
  purchase_date date,
  purchase_price numeric(12,2),
  currency text DEFAULT 'PLN',
  warranty_months integer,
  warranty_end_date date,
  location_id uuid REFERENCES locations(id) ON DELETE SET NULL,
  status_id uuid REFERENCES statuses(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES employees(id) ON DELETE SET NULL,
  description text,
  image_url text,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- 8. ASSET_HISTORY TABLE (audit trail)
CREATE TABLE IF NOT EXISTS asset_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  action text NOT NULL,
  field_name text,
  old_value text,
  new_value text,
  description text,
  performed_by uuid REFERENCES auth.users(id),
  performed_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status_id);
CREATE INDEX IF NOT EXISTS idx_assets_location ON assets(location_id);
CREATE INDEX IF NOT EXISTS idx_assets_assigned_to ON assets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_assets_serial_number ON assets(serial_number);
CREATE INDEX IF NOT EXISTS idx_assets_asset_tag ON assets(asset_tag);
CREATE INDEX IF NOT EXISTS idx_asset_history_asset ON asset_history(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_history_date ON asset_history(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_employees_location ON employees(location_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role_id);

-- Enable RLS on all tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_history ENABLE ROW LEVEL SECURITY;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles up
    JOIN roles r ON r.id = up.role_id
    WHERE up.user_id = auth.uid() AND r.name = 'Admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user is manager or admin
CREATE OR REPLACE FUNCTION is_manager_or_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles up
    JOIN roles r ON r.id = up.role_id
    WHERE up.user_id = auth.uid() AND r.name IN ('Admin', 'Manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- RLS POLICIES FOR ROLES
DROP POLICY IF EXISTS "roles_select" ON roles;
CREATE POLICY "roles_select" ON roles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "roles_insert" ON roles;
CREATE POLICY "roles_insert" ON roles FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "roles_update" ON roles;
CREATE POLICY "roles_update" ON roles FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- RLS POLICIES FOR USER_PROFILES
DROP POLICY IF EXISTS "user_profiles_select" ON user_profiles;
CREATE POLICY "user_profiles_select" ON user_profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "user_profiles_insert" ON user_profiles;
CREATE POLICY "user_profiles_insert" ON user_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "user_profiles_update" ON user_profiles;
CREATE POLICY "user_profiles_update" ON user_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id OR is_admin()) WITH CHECK (auth.uid() = user_id OR is_admin());

-- RLS POLICIES FOR CATEGORIES
DROP POLICY IF EXISTS "categories_select" ON categories;
CREATE POLICY "categories_select" ON categories FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "categories_insert" ON categories;
CREATE POLICY "categories_insert" ON categories FOR INSERT TO authenticated WITH CHECK (is_manager_or_admin());

DROP POLICY IF EXISTS "categories_update" ON categories;
CREATE POLICY "categories_update" ON categories FOR UPDATE TO authenticated USING (is_manager_or_admin()) WITH CHECK (is_manager_or_admin());

-- RLS POLICIES FOR LOCATIONS
DROP POLICY IF EXISTS "locations_select" ON locations;
CREATE POLICY "locations_select" ON locations FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "locations_insert" ON locations;
CREATE POLICY "locations_insert" ON locations FOR INSERT TO authenticated WITH CHECK (is_manager_or_admin());

DROP POLICY IF EXISTS "locations_update" ON locations;
CREATE POLICY "locations_update" ON locations FOR UPDATE TO authenticated USING (is_manager_or_admin()) WITH CHECK (is_manager_or_admin());

-- RLS POLICIES FOR STATUSES
DROP POLICY IF EXISTS "statuses_select" ON statuses;
CREATE POLICY "statuses_select" ON statuses FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "statuses_insert" ON statuses;
CREATE POLICY "statuses_insert" ON statuses FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "statuses_update" ON statuses;
CREATE POLICY "statuses_update" ON statuses FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- RLS POLICIES FOR EMPLOYEES
DROP POLICY IF EXISTS "employees_select" ON employees;
CREATE POLICY "employees_select" ON employees FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "employees_insert" ON employees;
CREATE POLICY "employees_insert" ON employees FOR INSERT TO authenticated WITH CHECK (is_manager_or_admin());

DROP POLICY IF EXISTS "employees_update" ON employees;
CREATE POLICY "employees_update" ON employees FOR UPDATE TO authenticated USING (is_manager_or_admin()) WITH CHECK (is_manager_or_admin());

DROP POLICY IF EXISTS "employees_delete" ON employees;
CREATE POLICY "employees_delete" ON employees FOR DELETE TO authenticated USING (is_admin());

-- RLS POLICIES FOR ASSETS
DROP POLICY IF EXISTS "assets_select" ON assets;
CREATE POLICY "assets_select" ON assets FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "assets_insert" ON assets;
CREATE POLICY "assets_insert" ON assets FOR INSERT TO authenticated WITH CHECK (is_manager_or_admin());

DROP POLICY IF EXISTS "assets_update" ON assets;
CREATE POLICY "assets_update" ON assets FOR UPDATE TO authenticated USING (is_manager_or_admin()) WITH CHECK (is_manager_or_admin());

DROP POLICY IF EXISTS "assets_delete" ON assets;
CREATE POLICY "assets_delete" ON assets FOR DELETE TO authenticated USING (is_admin());

-- RLS POLICIES FOR ASSET_HISTORY (append-only)
DROP POLICY IF EXISTS "asset_history_select" ON asset_history;
CREATE POLICY "asset_history_select" ON asset_history FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "asset_history_insert" ON asset_history;
CREATE POLICY "asset_history_insert" ON asset_history FOR INSERT TO authenticated WITH CHECK (is_manager_or_admin());

-- TRIGGER to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.columns WHERE column_name = 'updated_at' AND table_schema = 'public'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON %I', t, t);
    EXECUTE format('CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t, t);
  END LOOP;
END;
$$;

-- INSERT DEFAULT DATA

-- Default roles
INSERT INTO roles (name, description, permissions) VALUES
  ('Admin', 'Full system access with user management', '["read", "write", "delete", "manage_users", "manage_settings"]'::jsonb),
  ('Manager', 'Can manage assets and view reports', '["read", "write", "view_reports"]'::jsonb),
  ('Employee', 'Can view own assigned assets', '["read_own"]'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Default categories
INSERT INTO categories (name, description, icon, color, sort_order) VALUES
  ('Laptop', 'Portable computers', 'laptop', '#3B82F6', 1),
  ('Komputer', 'Desktop computers', 'monitor', '#10B981', 2),
  ('Monitor', 'Computer monitors', 'monitor', '#6366F1', 3),
  ('Telefon', 'Mobile phones', 'smartphone', '#F59E0B', 4),
  ('Tablet', 'Tablet devices', 'tablet', '#EC4899', 5),
  ('Drukarka', 'Printers and scanners', 'printer', '#8B5CF6', 6),
  ('Meble', 'Office furniture', 'armchair', '#14B8A6', 7),
  ('Akcesoria', 'Accessories and peripherals', 'cable', '#64748B', 8),
  ('Inne', 'Other equipment', 'package', '#94A3B8', 9)
ON CONFLICT DO NOTHING;

-- Default locations
INSERT INTO locations (name, city, country) VALUES
  ('Warszawa HQ', 'Warszawa', 'Poland'),
  ('Kraków Office', 'Kraków', 'Poland'),
  ('Gdańsk Office', 'Gdańsk', 'Poland'),
  ('Magazyn', 'Warszawa', 'Poland'),
  ('Home Office', '', 'Poland')
ON CONFLICT DO NOTHING;

-- Default statuses
INSERT INTO statuses (name, description, color, sort_order) VALUES
  ('Dostępny', 'Equipment available for assignment', '#10B981', 1),
  ('Przypisany', 'Equipment assigned to employee', '#3B82F6', 2),
  ('W serwisie', 'Equipment being repaired', '#F59E0B', 3),
  ('Uszkodzony', 'Equipment is damaged', '#EF4444', 4),
  ('Wycofany', 'Equipment retired from use', '#6B7280', 5)
ON CONFLICT DO NOTHING;