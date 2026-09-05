-- Lead org name + Advanced plan (free multisucursal tier for /comenzar).

alter table public.leads
  add column if not exists org_name text;

create index if not exists leads_org_name_idx
  on public.leads (lower(trim(org_name)));

insert into public.plans (slug, display_name, price_ars_monthly, price_ars_annual, feature_flags, limits, sort_order)
values
  (
    'advanced',
    'Advanced',
    0,
    0,
    jsonb_build_object(
      'account', true,
      'browser_session', true,
      'help_privacy', true,
      'inbox', true,
      'integrations', true,
      'integrations_whatsapp', true,
      'integrations_instagram', true,
      'tasks', true,
      'notifications', true,
      'copi_enabled', true,
      'commerce_inventory', true,
      'commerce_pos', true,
      'multi_sucursales', true
    ),
    jsonb_build_object('users', null, 'sucursales', null),
    40
  )
on conflict (slug) do update
set
  display_name = excluded.display_name,
  price_ars_monthly = 0,
  price_ars_annual = 0,
  limits = excluded.limits,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

-- Align existing catalog prices to $0 while subscriptions are free.
update public.plans
set
  price_ars_monthly = 0,
  price_ars_annual = 0,
  updated_at = now()
where slug in ('starter', 'basico', 'pro', 'advanced');
