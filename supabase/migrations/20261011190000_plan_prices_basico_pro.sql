-- Public list prices for Básico / Pro (Enterprise stays custom / unset).
-- Annual = 11 × monthly (1 month free).

update public.plans
set
  price_ars_monthly = 65000,
  price_ars_annual = 715000,
  updated_at = now()
where slug in ('basico', 'starter');

update public.plans
set
  price_ars_monthly = 85000,
  price_ars_annual = 935000,
  updated_at = now()
where slug = 'pro';

-- Enterprise / Max / Advanced: keep custom (no fixed list price).
update public.plans
set
  price_ars_monthly = 0,
  price_ars_annual = 0,
  updated_at = now()
where slug in ('enterprise', 'max', 'advanced');
