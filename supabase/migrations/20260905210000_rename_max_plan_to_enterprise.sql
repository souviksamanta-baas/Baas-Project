-- Rename Max plan → Enterprise (public onboarding /comenzar).

update public.plans
set
  slug = 'enterprise',
  display_name = 'Enterprise',
  updated_at = now()
where slug in ('max', 'advanced');

update public.leads
set plan_slug = 'enterprise'
where plan_slug in ('max', 'advanced');
