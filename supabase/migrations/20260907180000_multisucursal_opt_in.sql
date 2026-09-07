-- Multisucursal is opt-in via organizations.feature_flags.multi_sucursales.
-- Enterprise plan catalog must not force it onto every Enterprise org.

update public.plans
set
  feature_flags = coalesce(feature_flags, '{}'::jsonb) || jsonb_build_object(
    'multi_sucursales', false
  ),
  updated_at = now()
where slug in ('enterprise', 'max', 'advanced');
