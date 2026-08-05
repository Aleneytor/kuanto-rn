-- Cubre publicaciones tardías del BCV y permite una ejecución manual segura
-- desde SQL Editor sin revelar el secreto compartido del cron.

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid
    from cron.job
    where jobname = 'kuanto-mobile-bcv-late-retries'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end;
$$;

-- 20:05-23:35 VET del lunes al viernes equivale a 00:05-03:35 UTC
-- del martes al sábado. Complementa el bloque 17:05-19:35 ya configurado.
select cron.schedule(
  'kuanto-mobile-bcv-late-retries',
  '5,35 0-3 * * 2-6',
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
      body := '{"source":"cron-late"}'::jsonb,
      timeout_milliseconds := 25000
    );
  $job$
);

create or replace function private.trigger_bcv_ingestion()
returns bigint
language sql
security definer
set search_path = ''
as $$
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
    body := '{"source":"manual-sql"}'::jsonb,
    timeout_milliseconds := 25000
  );
$$;

revoke all on function private.trigger_bcv_ingestion() from public, anon, authenticated;

comment on function private.trigger_bcv_ingestion() is
  'Invoca ingest-bcv de forma asíncrona desde SQL Editor usando el secreto guardado en Vault.';
