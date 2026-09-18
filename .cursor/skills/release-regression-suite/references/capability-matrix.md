# Capability Matrix

Every capability below needs a status in the release report, plus the layer that covered it. Layer A is API/webhook E2E, Layer B is Maestro device flows, Layer C is the Copi suite, M is manual.

## Chats and messaging

- Inbound text message creates a conversation and a message row — A
- Inbound image hydrates media and renders in the bubble — A, B
- Inbound audio / voice note parses `message.audio`, hydrates media, and plays — A, B
- Inbound reaction upserts onto the target message and creates no message row — A, B
- Inbound reaction cleared with an empty emoji removes the reaction — A
- Duplicate webhook delivery is idempotent — A
- Unknown inbound message type degrades safely — A
- Status updates (sent, delivered, read, failed) update the message — A
- Outbound text, image, audio, reaction, edit, forward produce the correct Meta payload — A
- 24-hour window blocked composer message — A, B
- Swipe actions: read/unread toggle, pin, mute, archive, unarchive — A, B
- Pinned conversations sort above the rest — A, B
- Muted conversation produces no push notification — A
- Vaciar chat and Eliminar chat — A, B
- Message long-press overlay: emoji strip separate from the action card — B
- Responder sends `reply_to_message_id` — A, B
- Copiar, Reenviar, Editar — A, B
- Eliminar message stays hidden after realtime refresh — A, B
- Preguntar a Copi seeds the question and assigns the chat — A, B, C
- Asignar etiqueta writes the full lead label set — A, B
- Adjuntar sheet: brand outline icons, no circles, camera and gallery both open — B
- Agregar contacto writes to the device phonebook without a deprecation alert — B, M
- Voice note recording: mic records and sends audio, never transcribes — B
- OS keyboard microphone still transcribes into the text field — M

## Copi

Delegate to the `copi-automated-testing` skill and cite its report. At minimum confirm everything-Pro (`copi_enabled` gate), LLM turn-planner primary path, confirm-via-chat (sí/no / mixed), propose-then-confirm enforcement, the presupuesto exception, the four hard blockers, `resolveCopiModel`, WhatsApp confirm-before-send, task reminders and recurrence, and tenant isolation — C

## Inventory

- Product create and edit — A, B
- Add stock and stock import — A, B
- Sell flow including payment confirmation — A, B
- Subproduct edit — A
- Negative or oversized quantity rejected — A

## Cash

- Cash movement in and out — A, B
- Balances report totals — A, B
- Spanish currency formatting such as `$1.250` — B

## Appointments

- Availability calculation — A
- Create appointment — A, B
- Invite link accept — A
- Timezone correctness for `America/Argentina/Cordoba` — A

## Presupuestos and invoices

- Create presupuesto and view it — A, B
- PDF generation — A
- ARCA invoicing against the sandbox, never production — A, M

## Tasks

- Create, assign, and complete — A, B
- Absolute `remind_at` and daily/weekly/monthly recurrence — A, C
- Next instance created only on completion — A

## Auth, organizations, onboarding

- Phone OTP login and logout — A, B
- Onboarding to a usable organization — A, B
- Staff invite and accept — A
- Session resume and expiry — A
- Account deletion request — A

## Channels and integrations

- WhatsApp connect and config — A, B
- Instagram and Facebook webhook and messaging paths — A
- Notification registration and delivery — A, M

## Cross-cutting

- Cross-tenant rejection on every authenticated route — A (release blocker if it fails)
- RLS coverage validation passes — static
- Migrations validate and apply cleanly — static
- Typecheck, lint, API build, Expo config — static
- Tab navigation and deep links — B
- Spanish UI copy across all reached screens — B
