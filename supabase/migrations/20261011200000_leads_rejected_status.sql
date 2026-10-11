-- Allow staff to reject /comenzar leads while keeping them listed.
alter table public.leads
  drop constraint if exists leads_status_check;

alter table public.leads
  add constraint leads_status_check
  check (status in ('new', 'in_progress', 'converted', 'closed', 'rejected'));
