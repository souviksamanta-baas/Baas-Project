-- KAN-367 / KAN-365: Instagram OAuth fields + messaging window + event processing.

alter table public.instagram_config
  alter column page_id drop not null;

alter table public.instagram_config
  add column if not exists token_expires_at timestamptz,
  add column if not exists token_status text not null default 'active'
    check (token_status in ('active', 'expiring', 'expired', 'revoked')),
  add column if not exists scopes text[] not null default '{}'::text[],
  add column if not exists profile_picture_url text;

alter table public.conversations
  add column if not exists instagram_config_id uuid references public.instagram_config(id) on delete set null,
  add column if not exists messaging_window_expires_at timestamptz,
  add column if not exists last_inbound_at timestamptz;

create index if not exists conversations_instagram_config_id_idx
  on public.conversations (instagram_config_id)
  where instagram_config_id is not null;

alter table public.instagram_message_events
  add column if not exists processed_at timestamptz,
  add column if not exists process_error text,
  add column if not exists webhook_timestamp timestamptz,
  add column if not exists recipient_igsid text;

create index if not exists instagram_message_events_unprocessed_idx
  on public.instagram_message_events (received_at)
  where processed_at is null;
