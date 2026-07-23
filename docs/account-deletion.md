# Eliminación de cuenta y datos (Nexolia Owner)

**Jira:** [KAN-363](https://souviksamanta.atlassian.net/browse/KAN-363)  
Este documento es la **URL pública orientada a Play Store / App Store** para solicitudes de eliminación de cuenta.

## Cómo eliminar tu cuenta desde la app

1. Abrí **Mi cuenta → Privacidad y datos**.
2. Escribí `ELIMINAR` en el campo de confirmación.
3. Tocá **Eliminar mi cuenta**.

Eso:

- elimina tu usuario de autenticación (Supabase Auth);
- elimina los negocios de los que sos **único dueño** (cascade de datos del tenant);
- si compartís un negocio con otros dueños, primero debés **transferir la propiedad**.

## Cómo eliminar o archivar un negocio

En **Privacidad y datos** (solo dueño):

| Acción | Confirmación | Efecto |
| --- | --- | --- |
| Archivar negocio | `ARCHIVAR` | Soft-delete: el negocio deja de aparecer; canales desconectados |
| Eliminar negocio | `ELIMINAR` | Hard-delete con cascade de centros, miembros, inbox, inventario, etc. |

## Salir de un negocio (equipo)

Los miembros **staff** pueden **Salir del negocio** sin borrar la cuenta.

## Exportación de datos (GDPR)

Los dueños pueden **Exportar datos del negocio** (JSON preliminar: org, miembros, contactos, conversaciones, productos).

## Solicitud por email (si no podés entrar a la app)

Escribí a soporte Nexolia (WhatsApp de ayuda en la app o el canal publicado en la ficha de Play/App Store) con:

- email o teléfono de la cuenta;
- nombre del negocio;
- pedido explícito de borrado.

Procesamos la baja en un plazo razonable (objetivo ≤ 30 días).

## Qué se borra / qué puede quedar

- **Se borra:** membresías, org (si aplica), conversaciones, productos/stock del tenant, tokens push, configuración WhatsApp/Instagram del tenant.
- **Puede quedar temporalmente:** backups operativos, logs de infraestructura, registros legales mínimos, hasta la rotación habitual.

Actualizá esta página cuando el hosting público de Nexolia Web esté vivo (reemplazar el enlace de GitHub por el dominio de producto).
