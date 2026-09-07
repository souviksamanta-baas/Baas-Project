import { apiFetchAuthJson } from './client';

export type BusinessCenterRecord = {
  id: string;
  isActive: boolean;
  isDefault: boolean;
  name: string;
  organizationId: string;
  timezone: string;
};

export async function listBusinessCentersApi(
  organizationId: string,
): Promise<BusinessCenterRecord[]> {
  return apiFetchAuthJson<BusinessCenterRecord[]>(
    `/organizations/${encodeURIComponent(organizationId)}/business-centers`,
  );
}

export async function createBusinessCenterApi(params: {
  name: string;
  organizationId: string;
  timezone?: string;
}): Promise<BusinessCenterRecord> {
  return apiFetchAuthJson<BusinessCenterRecord>(
    `/organizations/${encodeURIComponent(params.organizationId)}/business-centers`,
    {
      body: JSON.stringify({
        name: params.name,
        ...(params.timezone ? { timezone: params.timezone } : {}),
      }),
      method: 'POST',
    },
  );
}

export async function updateBusinessCenterApi(params: {
  businessCenterId: string;
  isActive?: boolean;
  name?: string;
  organizationId: string;
  timezone?: string;
}): Promise<BusinessCenterRecord> {
  return apiFetchAuthJson<BusinessCenterRecord>(
    `/organizations/${encodeURIComponent(params.organizationId)}/business-centers/${encodeURIComponent(params.businessCenterId)}`,
    {
      body: JSON.stringify({
        ...(params.name !== undefined ? { name: params.name } : {}),
        ...(params.timezone !== undefined ? { timezone: params.timezone } : {}),
        ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
      }),
      method: 'PATCH',
    },
  );
}

export async function setDefaultBusinessCenterApi(params: {
  businessCenterId: string;
  organizationId: string;
}): Promise<BusinessCenterRecord> {
  return apiFetchAuthJson<BusinessCenterRecord>(
    `/organizations/${encodeURIComponent(params.organizationId)}/business-centers/${encodeURIComponent(params.businessCenterId)}/set-default`,
    { method: 'POST' },
  );
}
