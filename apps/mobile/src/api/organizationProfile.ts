import { supabase } from '../lib/supabase';

export type OrganizationProfile = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  contactEmail: string;
  contactPhone: string;
  country: string;
  id: string;
  name: string;
  postalCode: string;
  province: string;
  timezone: string;
};

type OrganizationProfileRow = {
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  country: string | null;
  id: string;
  name: string;
  postal_code: string | null;
  province: string | null;
  timezone: string;
};

function mapOrganizationProfile(row: OrganizationProfileRow): OrganizationProfile {
  return {
    addressLine1: row.address_line1 ?? '',
    addressLine2: row.address_line2 ?? '',
    city: row.city ?? '',
    contactEmail: row.contact_email ?? '',
    contactPhone: row.contact_phone ?? '',
    country: row.country ?? 'AR',
    id: row.id,
    name: row.name,
    postalCode: row.postal_code ?? '',
    province: row.province ?? '',
    timezone: row.timezone,
  };
}

export async function getOrganizationProfile(organizationId: string): Promise<OrganizationProfile> {
  const { data, error } = await supabase
    .from('organizations')
    .select(
      'id, name, timezone, contact_email, contact_phone, address_line1, address_line2, city, province, postal_code, country',
    )
    .eq('id', organizationId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapOrganizationProfile(data as OrganizationProfileRow);
}

export async function updateOrganizationProfile(params: {
  organizationId: string;
  profile: Omit<OrganizationProfile, 'id'>;
}): Promise<void> {
  const name = params.profile.name.trim();
  if (!name) {
    throw new Error('Ingresá el nombre del negocio.');
  }

  const { error } = await supabase
    .from('organizations')
    .update({
      address_line1: params.profile.addressLine1.trim() || null,
      address_line2: params.profile.addressLine2.trim() || null,
      city: params.profile.city.trim() || null,
      contact_email: params.profile.contactEmail.trim() || null,
      contact_phone: params.profile.contactPhone.trim() || null,
      country: params.profile.country.trim() || 'AR',
      name,
      postal_code: params.profile.postalCode.trim() || null,
      province: params.profile.province.trim() || null,
      timezone: params.profile.timezone.trim() || 'America/Argentina/Cordoba',
    })
    .eq('id', params.organizationId);

  if (error) {
    throw new Error(error.message);
  }
}
