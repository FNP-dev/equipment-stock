export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  role_id: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  role?: Role;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Location {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  country: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Status {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  position: string | null;
  location_id: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  location?: Location;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Assignment {
  id: string;
  asset_id: string;
  employee_id: string | null;
  assigned_at: string;
  returned_at: string | null;
  notes: string | null;
  created_at: string;
  asset?: Asset;
  employee?: Employee;
}

export interface Repair {
  id: string;
  asset_id: string;
  description: string;
  cost: number;
  repair_date: string;
  vendor: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  asset?: Asset;
}

export interface Document {
  id: string;
  asset_id: string | null;
  name: string;
  type: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

export interface Asset {
  id: string;
  name: string;
  category_id: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  asset_tag: string | null;
  inventory_number: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  currency: string;
  warranty_months: number | null;
  warranty_end_date: string | null;
  location_id: string | null;
  status_id: string | null;
  assigned_to: string | null;
  supplier_id: string | null;
  description: string | null;
  image_url: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  category?: Category;
  location?: Location;
  status?: Status;
  employee?: Employee;
  supplier?: Supplier;
  assignments?: Assignment[];
  repairs?: Repair[];
  documents?: Document[];
}

export interface AssetHistory {
  id: string;
  asset_id: string;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  description: string | null;
  performed_by: string | null;
  performed_at: string;
  asset?: Asset;
  performer?: UserProfile;
}

export interface DashboardStats {
  totalAssets: number;
  assignedAssets: number;
  availableAssets: number;
  inServiceAssets: number;
  damagedAssets: number;
  retiredAssets: number;
  totalEmployees: number;
  totalLocations: number;
  warrantyEndingSoon: number;
}

export type UserRole = 'Admin' | 'Manager' | 'Employee';

export interface AuthUser {
  id: string;
  email: string;
  profile: UserProfile | null;
  role: UserRole;
}
