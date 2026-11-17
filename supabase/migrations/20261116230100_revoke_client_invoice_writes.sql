-- Fiscal invoices (comprobantes) are issued exclusively via the Nest
-- `/arca` and `/invoice` endpoints using the service-role client. Nothing in
-- the mobile or web apps writes to `public.invoices` directly, so remove
-- INSERT/UPDATE from the client-facing roles. SELECT remains so dueños/co-
-- dueños/managers can still read their own org's invoices via RLS.
--
-- The matching RLS insert/update policies are dropped because a revoked
-- privilege cannot be re-granted by a policy and the policies are now dead
-- weight that we do not want to re-enable by accident.

revoke insert, update on public.invoices from authenticated;
revoke insert, update, select on public.invoices from anon;

drop policy if exists invoices_insert_members on public.invoices;
drop policy if exists invoices_update_members on public.invoices;

-- Service role keeps full control (set in 20260807170000_arca_fiscal_foundation.sql).
grant all on public.invoices to service_role;
