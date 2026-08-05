-- Ajusta el texto del push "nueva tasa BCV": más conciso, incluye USD y EUR.

create or replace function private.notify_new_bcv_rate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_messages jsonb;
  v_usd_text text;
  v_eur_text text;
  v_title text;
  v_body text;
begin
  if tg_op = 'UPDATE' and old.bcv_usd is not distinct from new.bcv_usd then
    return new;
  end if;

  -- Evita pushes por correcciones/importaciones de fechas históricas.
  if new.bcv_usd is null
    or new.rate_date < (now() at time zone 'America/Caracas')::date then
    return new;
  end if;

  v_usd_text := replace(
    to_char(new.bcv_usd, 'FM999999999990.00'),
    '.',
    ','
  );
  v_eur_text := case
    when new.bcv_eur is null then null
    else replace(to_char(new.bcv_eur, 'FM999999999990.00'), '.', ',')
  end;

  v_title := case
    when v_eur_text is null then '💵 BCV: Bs. ' || v_usd_text
    else '💵 BCV: Bs. ' || v_usd_text || ' / €' || v_eur_text
  end;
  v_body := 'Nueva tasa oficial disponible. Tócala para ver el detalle.';

  -- Expo admite hasta 100 mensajes por solicitud.
  for v_messages in
    select jsonb_agg(message order by token)
    from (
      select
        token,
        ((row_number() over (order by token) - 1) / 100)::integer as batch_number,
        jsonb_build_object(
          'to', token,
          'title', v_title,
          'body', v_body,
          'sound', 'default',
          'priority', 'high',
          'channelId', 'bcv-alerts',
          'data', jsonb_build_object('type', 'bcv', 'date', new.rate_date)
        ) as message
      from public.device_push_tokens
      where enabled = true
    ) as queued_messages
    group by batch_number
    order by batch_number
  loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := v_messages,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Accept', 'application/json'
      ),
      timeout_milliseconds := 15000
    );
  end loop;

  return new;
end;
$$;

revoke all on function private.notify_new_bcv_rate()
  from public, anon, authenticated;
