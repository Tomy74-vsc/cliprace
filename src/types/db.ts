export type UserRole = 'admin' | 'brand' | 'creator';

export interface ProfileInsert {
  id: string;
  role: UserRole;
  email: string;
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  country?: string | null;
  is_active?: boolean;
  onboarding_complete?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProfileUpdate {
  display_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  country?: string | null;
  is_active?: boolean;
  onboarding_complete?: boolean;
  updated_at?: string;
}

export interface ProfileCreatorInsert {
  user_id: string;
  handle?: string | null;
  primary_platform?: 'tiktok' | 'instagram' | 'youtube';
  followers?: number;
  avg_views?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ProfileCreatorUpdate {
  handle?: string | null;
  primary_platform?: 'tiktok' | 'instagram' | 'youtube';
  followers?: number;
  avg_views?: number;
  updated_at?: string;
}

export interface ProfileBrandInsert {
  user_id: string;
  company_name: string;
  website?: string | null;
  industry?: string | null;
  vat_number?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  address_city?: string | null;
  address_postal_code?: string | null;
  address_country?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ProfileBrandUpdate {
  company_name?: string;
  website?: string | null;
  industry?: string | null;
  vat_number?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  address_city?: string | null;
  address_postal_code?: string | null;
  address_country?: string | null;
  updated_at?: string;
}
