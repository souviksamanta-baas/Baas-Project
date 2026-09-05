-- Plan Pro / Enterprise always include Copi Pro.
-- Align Enterprise plan flags and backfill orgs that already have Pro+ but Copi básico.

update public.plans
set
  feature_flags = coalesce(feature_flags, '{}'::jsonb) || jsonb_build_object(
    'copi_enabled', true,
    'copi_basic_reports', true,
    'copi_freeform_questions', true,
    'copi_pro_agent', true,
    'copi_voice', true,
    'copi_vision', true,
    'copi_custom_reports', true,
    'multi_sucursales', true,
    'inbox', true,
    'tasks', true,
    'account', true,
    'integrations', true,
    'notifications', true,
    'browser_session', true,
    'help_privacy', true,
    'integrations_whatsapp', true,
    'integrations_instagram', true,
    'integrations_messenger', true,
    'integrations_email', true,
    'integrations_sms', true
  ),
  updated_at = now()
where slug in ('enterprise', 'max', 'advanced');

update public.plans
set
  feature_flags = coalesce(feature_flags, '{}'::jsonb) || jsonb_build_object(
    'copi_pro_agent', true,
    'copi_voice', true,
    'copi_vision', true,
    'copi_custom_reports', true
  ),
  updated_at = now()
where slug = 'pro';

update public.organizations o
set
  feature_flags = coalesce(o.feature_flags, '{}'::jsonb) || jsonb_build_object(
    'copi_pro_agent', true,
    'copi_voice', true,
    'copi_vision', true,
    'copi_custom_reports', true
  ),
  updated_at = now()
from public.plans p
where o.plan_id = p.id
  and p.slug in ('pro', 'enterprise', 'max', 'advanced')
  and coalesce((o.feature_flags ->> 'copi_pro_agent')::boolean, false) is distinct from true;
