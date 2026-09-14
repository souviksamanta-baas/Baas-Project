-- Match phones with or without leading '+' (Supabase Auth stores either form).

create or replace function public.find_auth_user_id_by_phone(p_phone_e164 text)
returns uuid
language sql
stable
security definer
set search_path = auth, public
as $$
  with normalized as (
    select regexp_replace(coalesce(p_phone_e164, ''), '\D', '', 'g') as digits
  )
  select u.id
  from auth.users u, normalized n
  where n.digits <> ''
    and (
      regexp_replace(coalesce(u.phone, ''), '\D', '', 'g') = n.digits
      or regexp_replace(coalesce(u.raw_user_meta_data->>'auth_phone', ''), '\D', '', 'g') = n.digits
    )
  order by case
    when regexp_replace(coalesce(u.phone, ''), '\D', '', 'g') = n.digits then 0
    else 1
  end
  limit 1;
$$;

revoke all on function public.find_auth_user_id_by_phone(text) from public, anon, authenticated;
grant execute on function public.find_auth_user_id_by_phone(text) to service_role;
