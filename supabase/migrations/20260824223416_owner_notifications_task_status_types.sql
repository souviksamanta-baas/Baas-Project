-- Allow KAN-401 task status / postpone notification types on owner_notifications.
-- Completing a task emits task.status_changed; without these values the CHECK fails
-- after the status update already committed, so the API returned 500 while the
-- task was already marked done.

alter table public.owner_notifications
  drop constraint if exists owner_notifications_notification_type_check;

alter table public.owner_notifications
  add constraint owner_notifications_notification_type_check
  check (
    notification_type in (
      'low_stock',
      'stock.low',
      'digest.daily',
      'digest.weekly',
      'task.assigned',
      'task.reminder',
      'task.overdue',
      'task.snooze_wake',
      'task.postpone_wake',
      'task.status_changed',
      'appointment.reminder',
      'appointment.assigned',
      'appointment.starting',
      'inbox.new_message',
      'inbox.unanswered',
      'sales.completed',
      'payment.received',
      'payment.failed',
      'stock.movement',
      'quote.accepted',
      'invoice.overdue',
      'copi.action_needed',
      'team.invite_accepted'
    )
  );
