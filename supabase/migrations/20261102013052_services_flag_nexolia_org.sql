-- Professional services stay off unless an organization opts in.
-- Turn the flag on only for the Nexolia organization.
update public.organizations
set feature_flags = coalesce(feature_flags, '{}'::jsonb) || jsonb_build_object('services', true)
where lower(btrim(name)) = 'nexolia';
