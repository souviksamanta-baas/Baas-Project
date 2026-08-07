import { apiFetchAuthJson } from './client';

export type ArcaTaxCondition =
  | 'monotributo'
  | 'responsable_inscripto'
  | 'exento'
  | 'no_responsable'
  | 'consumidor_final';

export type ArcaConnectionSummary = {
  authorizationStatus: 'pending' | 'connected' | 'error' | 'disabled' | 'awaiting_delegation';
  connectedAt: string | null;
  cuit: string | null;
  environment: 'homologacion' | 'production';
  hasCredentials: boolean;
  lastError: string | null;
  pointOfSale: number | null;
  taxCondition: ArcaTaxCondition | null;
};

export async function getArcaConnection(organizationId: string): Promise<ArcaConnectionSummary> {
  const query = new URLSearchParams({ organizationId });
  return apiFetchAuthJson<ArcaConnectionSummary>(`/arca/connection?${query.toString()}`);
}

export async function upsertArcaConnection(params: {
  cuit: string;
  environment?: 'homologacion' | 'production';
  organizationId: string;
  pointOfSale: number;
  taxCondition: ArcaTaxCondition;
}): Promise<ArcaConnectionSummary> {
  return apiFetchAuthJson<ArcaConnectionSummary>('/arca/connection', {
    body: JSON.stringify(params),
    method: 'POST',
  });
}

export async function confirmArcaDelegation(
  organizationId: string,
): Promise<ArcaConnectionSummary> {
  return apiFetchAuthJson<ArcaConnectionSummary>('/arca/connection/confirm-delegation', {
    body: JSON.stringify({ organizationId }),
    method: 'POST',
  });
}
