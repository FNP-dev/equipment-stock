/*
# Enhanced Asset Management Schema

## New tables:
- assignments: Track equipment assignments with history
- repairs: Track equipment repairs and maintenance
- documents: Store equipment documents/files
- suppliers: Track equipment suppliers

## Modified tables:
- assets: Add inventory_number, supplier_id, images
*/

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add supplier column to assets
ALTER TABLE assets ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id);
ALTER TABLE assets ADD COLUMN IF NOT EXISTS inventory_number TEXT UNIQUE;

-- Create unique index on inventory_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_inventory_number ON assets(inventory_number) WHERE inventory_number IS NOT NULL;

-- Assignments table (tracks assignment history)
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  returned_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Repairs table
CREATE TABLE IF NOT EXISTS repairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  cost DECIMAL(12,2) DEFAULT 0,
  repair_date DATE DEFAULT now()::date,
  vendor TEXT,
  status TEXT DEFAULT 'Completed',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE repairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for suppliers
CREATE POLICY "suppliers_select" ON suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "suppliers_insert" ON suppliers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "suppliers_update" ON suppliers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- RLS policies for assignments
CREATE POLICY "assignments_select" ON assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "assignments_insert" ON assignments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "assignments_update" ON assignments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- RLS policies for repairs
CREATE POLICY "repairs_select" ON repairs FOR SELECT TO authenticated USING (true);
CREATE POLICY "repairs_insert" ON repairs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "repairs_update" ON repairs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- RLS policies for documents
CREATE POLICY "documents_select" ON documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "documents_insert" ON documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "documents_delete" ON documents FOR DELETE TO authenticated USING (true);

-- Seed some suppliers
INSERT INTO suppliers (name, contact_person, email, phone) VALUES
  ('Dell Poland', 'Marek Kowalski', 'zakupy@dell.pl', '+48 22 123 4567'),
  ('Apple Polska', 'Anna Nowak', 'biznes@apple.pl', '+48 22 987 6543'),
  ('HP Store', 'Piotr Wiśniewski', 'sales@hp.pl', '+48 22 555 1234'),
  ('Samsung Business', 'Katarzyna Lewandowska', 'b2b@samsung.pl', '+48 22 333 4444')
ON CONFLICT DO NOTHING;

-- Update existing assets with inventory numbers
UPDATE assets SET inventory_number = asset_tag WHERE inventory_number IS NULL AND asset_tag IS NOT NULL;
UPDATE assets SET supplier_id = (SELECT id FROM suppliers LIMIT 1) WHERE supplier_id IS NULL;