import { supabase } from '../lib/supabase';
import type { OwnerDashboard } from '../types/dashboard';

const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

export interface RegisterWhatsAppConnectionParams {
  displayPhoneNumber: string;
  organizationId: string;
  phoneNumberId: string;
  wabaId?: string;
}

export interface RegisterWhatsAppConnectionResult {
  displayPhoneNumber: string | null;
  lastError: string | null;
  phoneNumberId: string;
  status: OwnerDashboard['whatsappConnection']['status'];
  verifiedAt: string | null;
}

export async function registerWhatsAppConnection(
  params: RegisterWhatsAppConnectionParams,
): Promise<RegisterWhatsAppConnectionResult> {
  if (!apiBaseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is required to connect WhatsApp.');
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Iniciá sesión antes de conectar WhatsApp.');
  }

  const response = await fetch(`${apiBaseUrl}/whatsapp/connection/register`, {
    body: JSON.stringify(params),
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `No se pudo conectar WhatsApp (HTTP ${response.status}).`);
  }

  return (await response.json()) as RegisterWhatsAppConnectionResult;
}

export function whatsappConnectionLabel(
  connection: OwnerDashboard['whatsappConnection'],
): { subtitle: string; title: string; tone: 'danger' | 'muted' | 'success' | 'warning' } {
  switch (connection.status) {
    case 'connected':
      return {
        subtitle: connection.displayPhoneNumber ?? 'Número verificado',
        title: 'WhatsApp conectado',
        tone: 'success',
      };
    case 'pending':
      return {
        subtitle: 'Estamos verificando tu número con Meta',
        title: 'WhatsApp pendiente',
        tone: 'warning',
      };
    case 'error':
      return {
        subtitle: connection.lastError ?? 'Revisá la configuración en Meta',
        title: 'WhatsApp con error',
        tone: 'danger',
      };
    case 'disabled':
      return {
        subtitle: 'La conexión fue deshabilitada',
        title: 'WhatsApp deshabilitado',
        tone: 'muted',
      };
    default:
      return {
        subtitle: 'Conectá tu número de WhatsApp Business',
        title: 'WhatsApp sin configurar',
        tone: 'muted',
      };
  }
}
