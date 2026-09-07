-- Multisucursal is opt-in on the organization, not a Pro plan entitlement.

update public.plans
set
  feature_flags = coalesce(feature_flags, '{}'::jsonb) || jsonb_build_object(
    'multi_sucursales', false
  ),
  updated_at = now()
where slug = 'pro';
