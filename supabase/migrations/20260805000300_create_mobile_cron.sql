-- Configuración privilegiada y repetible de las automatizaciones móviles.
-- El secreto se suministra una sola vez desde un entorno administrativo y se
-- guarda cifrado en Vault; nunca forma parte de esta migración.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create or replace function public.configure_mobile_cron(
  p_cron_secret text,
  p_project_url text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret_id uuid;
  v_url_id uuid;
  v_job_id bigint;
begin
  if p_cron_secret is null or length(p_cron_secret) < 32 then
    raise exception 'cron secret must contain at least 32 characters';
  end if;
  if p_project_url is null
    or p_project_url !~ '^https://[a-z]{20}\.supabase\.co$' then
    raise exception 'invalid Supabase project URL';
  end if;

  select id into v_secret_id
  from vault.secrets
  where name = 'mobile_cron_secret';

  if v_secret_id is null then
    perform vault.create_secret(
      p_cron_secret,
      'mobile_cron_secret',
      'Shared authentication secret for Kuanto Mobile ingestion cron jobs'
    );
  else
    perform vault.update_secret(v_secret_id, p_cron_secret);
  end if;

  select id into v_url_id
  from vault.secrets
  where name = 'mobile_project_url';

  if v_url_id is null then
    perform vault.create_secret(
      p_project_url,
      'mobile_project_url',
      'Base URL for the Kuanto Mobile Supabase project'
    );
  else
    perform vault.update_secret(v_url_id, p_project_url);
  end if;

  for v_job_id in
    select jobid
    from cron.job
    where jobname in ('kuanto-mobile-p2p-hourly', 'kuanto-mobile-bcv-retries')
  loop
    perform cron.unschedule(v_job_id);
  end loop;

  perform cron.schedule(
    'kuanto-mobile-p2p-hourly',
    '5 * * * *',
    $job$
      select net.http_post(
        url := (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'mobile_project_url'
        ) || '/functions/v1/ingest-p2p',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'mobile_cron_secret'
          )
        ),
        body := '{"source":"cron"}'::jsonb,
        timeout_milliseconds := 25000
      );
    $job$
  );

  -- De lunes a viernes: 17:05, 17:35, 18:05, 18:35, 19:05 y 19:35 VET.
  -- Los reintentos son idempotentes porque daily_rates usa rate_date como PK.
  perform cron.schedule(
    'kuanto-mobile-bcv-retries',
    '5,35 21-23 * * 1-5',
    $job$
      select net.http_post(
        url := (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'mobile_project_url'
        ) || '/functions/v1/ingest-bcv',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'mobile_cron_secret'
          )
        ),
        body := '{"source":"cron"}'::jsonb,
        timeout_milliseconds := 25000
      );
    $job$
  );
end;
$$;

revoke all on function public.configure_mobile_cron(text, text)
  from public, anon, authenticated;
grant execute on function public.configure_mobile_cron(text, text)
  to service_role;
