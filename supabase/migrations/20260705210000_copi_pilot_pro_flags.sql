-- Enable Copi Pro feature flags for pilot organizations.
-- Basic flags remain on by default from copi_foundation migration.

update public.organizations
set feature_flags = feature_flags || jsonb_build_object(
  'copi_pro_agent', true,
  'copi_voice', true,
  'copi_vision', true,
  'copi_custom_reports', true
)
where name in ('Baas Admin', 'NEX Biz');
