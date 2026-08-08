# Eliminación de cuenta y datos (Nexolia Owner)

**Jira:** [KAN-363](https://souviksamanta.atlassian.net/browse/KAN-363)  
**URL pública (Play Store / App Store):** [https://nexolia.com.ar/eliminacion-de-cuenta](https://nexolia.com.ar/eliminacion-de-cuenta)  
Alias en inglés: [https://nexolia.com.ar/account-deletion](https://nexolia.com.ar/account-deletion)

Este documento en el repo refleja el contenido publicado en el sitio.

## Marco legal (Argentina)

Nexolia aplica estos criterios (no son asesoramiento legal; son la política operativa que copiamos):

| Norma | Qué usamos |
| --- | --- |
| [Ley 25.326](https://servicios.infoleg.gob.ar/infolegInternet/anexos/60000-64999/64790/norma.htm) art. 4.7 | Los datos personales se **destruyen** cuando dejan de ser necesarios o pertinentes a la finalidad (p. ej. login sin ningún negocio). |
| Ley 25.326 art. 16 | Derecho de **supresión / rectificación**: responder en **5 días hábiles** desde el pedido del titular. |
| Ley 25.326 art. 16.5 | La supresión **no procede** si hay **obligación legal de conservar** o perjuicio a derechos de terceros. |
| Ley 25.326 art. 14 | Derecho de acceso: respuesta en **10 días corridos**. |
| [CCyC art. 328](https://www.argentina.gob.ar/normativa/nacional/ley-26994-235975) | Libros / registros / instrumentos respaldatorios (p. ej. facturas): conservación **10 años** (salvo ley especial más larga). |

### Cómo lo traduce el producto

1. **Eliminar negocio** → borra el tenant (cascade). Luego borra cuentas Auth que **ya no tienen ninguna membresía** (staff y dueño huérfanos). Si alguien sigue en otro negocio (p. ej. NEX Biz), **su login se conserva**.
2. **Eliminar mi cuenta** → borra negocios de los que sos único dueño (con la misma limpieza de huérfanos) y tu usuario Auth.
3. **Facturación / comprobantes:** hoy el hard-delete del negocio elimina también filas operativas del tenant. Para cumplir CCyC 328 el comerciante debe **exportar** antes de eliminar; una bóveda fiscal a 10 años es mejora futura (KAN / backlog), no bloquea la baja de logins personales.
4. Pedidos por email a privacidad: objetivo **≤ 5 días hábiles** (art. 16), no 30 días.

## Cómo eliminar tu cuenta desde la app

1. Abrí **Mi cuenta → Privacidad y datos**.
2. Escribí `ELIMINAR` en el campo de confirmación.
3. Tocá **Eliminar mi cuenta**.

Eso:

- elimina tu usuario de autenticación (Supabase Auth);
- elimina los negocios de los que sos **único dueño** (cascade de datos del tenant + logins huérfanos);
- si compartís un negocio con otros dueños, primero debés **transferir la propiedad**.

## Cómo eliminar o archivar un negocio

En **Privacidad y datos** (solo dueño):

| Acción | Confirmación | Efecto |
| --- | --- | --- |
| Archivar negocio | `ARCHIVAR` | Soft-delete: el negocio deja de aparecer; canales desconectados |
| Eliminar negocio | `ELIMINAR` | Hard-delete del tenant + borrado de Auth users **sin otras membresías** |

## Salir de un negocio (equipo)

Los miembros **staff** pueden **Salir del negocio** sin borrar la cuenta (mientras no pidan baja de cuenta).

## Exportación de datos (Ley 25.326)

Los dueños pueden **Exportar datos del negocio** (JSON: org, miembros, contactos, conversaciones, productos). Recomendado **antes** de eliminar si necesitás conservar comprobantes.

## Solicitud por email (si no podés entrar a la app)

Escribí a [privacidad@nexolia.com.ar](mailto:privacidad@nexolia.com.ar) con:

- email o teléfono de la cuenta;
- nombre del negocio;
- pedido explícito de borrado / acceso / rectificación.

Plazo objetivo: **5 días hábiles** (supresión/rectificación) o **10 días corridos** (acceso), según Ley 25.326.

## Qué se borra / qué puede quedar

- **Se borra:** membresías, org (si aplica), conversaciones, productos/stock del tenant, tokens push, configuración WhatsApp/Instagram del tenant, challenges OTP, Auth users **huérfanos**.
- **Se conserva el login** si el usuario sigue en otro negocio.
- **Puede quedar temporalmente:** backups operativos, logs de infraestructura, hasta la rotación habitual (mínimo necesario; no sustituye un archivo fiscal de 10 años del comerciante).
