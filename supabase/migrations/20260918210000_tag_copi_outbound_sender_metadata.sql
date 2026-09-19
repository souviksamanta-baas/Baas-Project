-- Owner-app sender badges: tag AI outbound WhatsApp messages as Copi.
-- Production Nest may not yet persist nexolia_sender_* on insert; this backfills
-- immediately after Copi/Sales AI marks a reply as sent/executed.

create or replace function public.tag_copi_customer_reply_sender()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_external_message_id text;
  v_conversation_id uuid;
  v_body text;
begin
  if new.action_type is distinct from 'propose_customer_reply' then
    return new;
  end if;

  if new.status is distinct from 'executed' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status is not distinct from 'executed' then
    return new;
  end if;

  v_external_message_id := nullif(new.result->>'externalMessageId', '');
  v_body := coalesce(nullif(new.result->>'body', ''), nullif(new.payload->>'body', ''));

  begin
    v_conversation_id := nullif(new.result->>'conversationId', '')::uuid;
  exception
    when others then
      v_conversation_id := null;
  end;

  if v_conversation_id is null then
    begin
      v_conversation_id := nullif(new.payload->>'conversationId', '')::uuid;
    exception
      when others then
        v_conversation_id := null;
    end;
  end if;

  update public.conversation_messages as cm
  set metadata = coalesce(cm.metadata, '{}'::jsonb) || jsonb_build_object(
    'nexolia_sender_kind', 'copi',
    'nexolia_sender_label', 'Copi'
  )
  where cm.direction = 'outbound'
    and coalesce(cm.metadata->>'nexolia_sender_kind', '') is distinct from 'copi'
    and (
      (
        v_external_message_id is not null
        and cm.external_message_id = v_external_message_id
      )
      or (
        v_conversation_id is not null
        and v_body is not null
        and cm.conversation_id = v_conversation_id
        and cm.body = v_body
        and cm.created_at >= coalesce(new.executed_at, now()) - interval '5 minutes'
        and cm.created_at <= coalesce(new.executed_at, now()) + interval '1 minute'
      )
    );

  return new;
end;
$$;

drop trigger if exists tag_copi_customer_reply_sender on public.copi_action_proposals;
create trigger tag_copi_customer_reply_sender
after insert or update of status, result, executed_at
on public.copi_action_proposals
for each row
execute function public.tag_copi_customer_reply_sender();

create or replace function public.tag_sales_ai_outbound_sender()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text;
begin
  if new.status is distinct from 'sent' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.status is not distinct from 'sent' then
    return new;
  end if;

  v_body := coalesce(nullif(new.edited_body, ''), nullif(new.reply_body, ''));
  if v_body is null or new.conversation_id is null then
    return new;
  end if;

  update public.conversation_messages as cm
  set metadata = coalesce(cm.metadata, '{}'::jsonb) || jsonb_build_object(
    'nexolia_sender_kind', 'copi',
    'nexolia_sender_label', 'Copi'
  )
  where cm.direction = 'outbound'
    and cm.conversation_id = new.conversation_id
    and cm.body = v_body
    and coalesce(cm.metadata->>'nexolia_sender_kind', '') is distinct from 'copi'
    and cm.created_at >= coalesce(new.sent_at, now()) - interval '5 minutes'
    and cm.created_at <= coalesce(new.sent_at, now()) + interval '1 minute';

  return new;
end;
$$;

drop trigger if exists tag_sales_ai_outbound_sender on public.ai_drafts;
create trigger tag_sales_ai_outbound_sender
after insert or update of status, sent_at, edited_body, reply_body
on public.ai_drafts
for each row
execute function public.tag_sales_ai_outbound_sender();
