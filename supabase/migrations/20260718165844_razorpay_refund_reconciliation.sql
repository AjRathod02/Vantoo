create or replace function public.mark_gateway_refund_failed(
  p_gateway_refund_id text,
  p_failure_reason text
)
returns public.refund_attempts
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_refund public.refund_attempts%rowtype;
begin
  update public.refund_attempts
  set status = 'failed',
      failure_reason = p_failure_reason,
      updated_at = now()
  where gateway_refund_id = p_gateway_refund_id
    and status <> 'completed'
  returning * into v_refund;
  if v_refund.id is null then raise exception 'REFUND_ATTEMPT_NOT_FOUND'; end if;

  update public.orders
  set refund_status = case
        when exists (
          select 1 from public.refund_attempts
          where order_id = v_refund.order_id and status = 'processing'
        ) then 'processing'
        else 'requested'
      end,
      payment_status = case
        when payment_status = 'refund_initiated' then 'paid'
        else payment_status
      end,
      updated_at = now()
  where id = v_refund.order_id;
  return v_refund;
end;
$$;

revoke all on function public.mark_gateway_refund_failed(text, text)
  from public, anon, authenticated;
grant execute on function public.mark_gateway_refund_failed(text, text)
  to service_role;
