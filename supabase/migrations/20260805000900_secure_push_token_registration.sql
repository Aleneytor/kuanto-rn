-- La escritura directa mediante UPSERT requiere SELECT bajo RLS y expondría
-- tokens ajenos. Estos RPC permiten registrar/deshabilitar por conocimiento del
-- token sin conceder lectura ni acceso directo de escritura a la tabla.

revoke insert, update on table public.device_push_tokens from anon, authenticated;

drop policy if exists "push token insert" on public.device_push_tokens;
drop policy if exists "push token update" on public.device_push_tokens;

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
    or p_token !~ '^(ExponentPushToken|ExpoPushToken)\\[[^]]+\\]$' then
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
    or p_token !~ '^(ExponentPushToken|ExpoPushToken)\\[[^]]+\\]$' then
    raise exception 'invalid Expo push token';
  end if;

  update public.device_push_tokens
  set enabled = false,
      updated_at = now()
  where token = p_token;
end;
$$;

revoke all on function public.register_device_push_token(text, text, boolean)
  from public;
revoke all on function public.disable_device_push_token(text)
  from public;

grant execute on function public.register_device_push_token(text, text, boolean)
  to anon, authenticated;
grant execute on function public.disable_device_push_token(text)
  to anon, authenticated;

comment on function public.register_device_push_token(text, text, boolean) is
  'Registra un Expo token sin permitir lectura pública de device_push_tokens.';
comment on function public.disable_device_push_token(text) is
  'Deshabilita un Expo token por conocimiento de su valor.';

