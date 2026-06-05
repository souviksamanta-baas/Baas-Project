-- Owner decisions go through authenticated API endpoints so sends can remain
-- server-side. Mobile clients may read draft state, but should not directly
-- mutate approval/send status through Supabase.

drop policy if exists ai_drafts_update_members on public.ai_drafts;

revoke update on public.ai_drafts from authenticated;
grant select on public.ai_drafts to authenticated;
