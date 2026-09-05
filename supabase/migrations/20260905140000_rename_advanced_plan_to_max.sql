-- Rename Advanced plan → Max (public onboarding /comenzar).

update public.plans
set
  slug = 'max',
  display_name = 'Max',
  updated_at = now()
where slug = 'advanced';

update public.leads
set plan_slug = 'max'
where plan_slug = 'advanced';
