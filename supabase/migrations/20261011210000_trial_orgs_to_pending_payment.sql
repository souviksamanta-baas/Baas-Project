-- Move existing trial organizations to pending_payment so staff can confirm payment.
update public.organizations
set
  license_status = 'pending_payment',
  updated_at = now()
where license_status = 'trial'
  and archived_at is null;
