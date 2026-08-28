-- facebook_message_events is service-role only (webhook ingestion), same as
-- whatsapp_message_events / instagram_message_events. RLS was missing from the
-- original create, which left the table open to anon/authenticated via the API.

alter table public.facebook_message_events enable row level security;
alter table public.facebook_message_events force row level security;

revoke all on public.facebook_message_events from anon, authenticated;
grant all on public.facebook_message_events to service_role;

-- Normalize revoke wording for CI coverage checks (already service-only).
revoke all on public.instagram_message_events from anon, authenticated;
grant all on public.instagram_message_events to service_role;
