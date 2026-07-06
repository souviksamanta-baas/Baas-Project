import { useInboxContext, type InboxState } from '../context/InboxProvider';

/** Shared inbox from InboxProvider (org/center args kept for call-site compatibility). */
export function useInbox(
  _organizationId: string | null,
  _businessCenterId: string | null,
): InboxState {
  return useInboxContext();
}
