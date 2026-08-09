-- Default and backfill: single-sucursal mode (multi_sucursales = false).
alter table public.organizations
  alter column feature_flags set default jsonb_build_object(
    'copi_enabled', true,
    'copi_basic_reports', true,
    'copi_freeform_questions', true,
    'copi_pro_agent', false,
    'copi_voice', false,
    'copi_vision', false,
    'copi_custom_reports', false,
    'multi_sucursales', false
  );

update public.organizations
set feature_flags = coalesce(feature_flags, '{}'::jsonb) || jsonb_build_object('multi_sucursales', false)
where coalesce(feature_flags ->> 'multi_sucursales', '') = '';
