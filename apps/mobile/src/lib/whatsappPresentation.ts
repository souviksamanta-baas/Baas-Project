import type { OwnerDashboard } from '../types/dashboard';

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
