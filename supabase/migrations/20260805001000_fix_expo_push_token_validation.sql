-- Corrige el escape de corchetes para aceptar ExpoPushToken[...] y
-- ExponentPushToken[...] sin relajar el resto de la validación.

alter table public.device_push_tokens
  drop constraint if exists device_push_tokens_token_valid;
alter table public.device_push_tokens
  add constraint device_push_tokens_token_valid check (
    token ~ '^(ExponentPushToken|ExpoPushToken)[[][^]]+[]]$'
  );

create or replace function public.register_device_push_token(
  p_token text,
  p_platform text,
  p_enabled boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_token is null
    or p_token !~ '^(ExponentPushToken|ExpoPushToken)[[][^]]+[]]$' then
    raise exception 'invalid Expo push token';
  end if;
  if p_platform is not null and p_platform not in ('android', 'ios') then
    raise exception 'invalid push platform';
  end if;
  if p_enabled is null then
    raise exception 'enabled is required';
  end if;

  insert into public.device_push_tokens (
    token,
    platform,
    enabled,
    updated_at
  )
  values (
    p_token,
    p_platform,
    p_enabled,
    now()
  )
  on conflict (token) do update set
    platform = excluded.platform,
    enabled = excluded.enabled,
    updated_at = excluded.updated_at;
end;
$$;

create or replace function public.disable_device_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_token is null
    or p_token !~ '^(ExponentPushToken|ExpoPushToken)[[][^]]+[]]$' then
    raise exception 'invalid Expo push token';
  end if;

  update public.device_push_tokens
  set enabled = false,
      updated_at = now()
  where token = p_token;
end;
$$;

