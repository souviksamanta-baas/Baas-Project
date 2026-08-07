-- Custom bottom-nav shortcut (right of Copi). Default: Ventas.
alter table public.organizations
  add column if not exists nav_shortcut text not null default 'ventas';

comment on column public.organizations.nav_shortcut is
  'Bottom nav custom shortcut id (ventas or a Más menu row id).';
