# Backend independiente de Kuanto Mobile

Este directorio define el backend nuevo de la aplicación móvil. No se enlaza,
modifica ni despliega sobre el proyecto Supabase utilizado por la web actual.

## Estado actual

- Una tabla pública de solo lectura, `public.daily_rates`.
- Tablas privadas para observaciones crudas y ejecuciones de los procesos de ingesta.
- RLS explícita: `anon` y `authenticated` solo pueden leer `daily_rates`.
- Un contrato de una fila por día para evitar descargar miles de ticks P2P.
- Caché offline en el dispositivo mediante AsyncStorage.
- Historial público de la web copiado una sola vez al proyecto móvil.
- Ingesta P2P horaria y reintentos BCV programados con `pg_cron`.
- Edge Functions protegidas por un secreto compartido almacenado en Vault.

El push remoto del BCV se envía mediante Expo cuando `bcv_usd` cambia para la
fecha actual o una fecha futura. Los recordatorios locales continúan funcionando
sin conexión y no dependen de Supabase.

## Contrato consumido por la app

Cada fila de `daily_rates` representa una fecha de Venezuela:

| Columna | Uso |
| --- | --- |
| `rate_date` | Fecha `YYYY-MM-DD` y clave primaria. |
| `bcv_usd`, `bcv_eur` | Tasas oficiales; pueden ser nulas en días sin publicación. |
| `p2p_average` | Referencia USDT más reciente mostrada por la app. |
| `p2p_daily_average` | Promedio del día usado por gráficas e historial. |
| `p2p_buy_average`, `p2p_sell_average` | Promedios de compra y venta. |
| `p2p_sources` | Desglose de Binance y Bybit. |
| `bcv_published_at`, `p2p_observed_at` | Instantes reales de actualización. |

La forma esperada para `p2p_sources` es:

```json
{
  "binance": { "buy": 0, "sell": 0 },
  "bybit": { "buy": 0, "sell": 0 }
}
```

## Crear el proyecto remoto

1. Crear un proyecto nuevo en Supabase, por ejemplo `kuanto-mobile`.
2. No reutilizar claves, cron jobs ni funciones del proyecto web.
3. Autenticar y enlazar la CLI únicamente al identificador del proyecto nuevo:

```powershell
npx supabase login
npx supabase link --project-ref ID_DEL_PROYECTO_MOBILE
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
```

No ejecutar `db reset --linked`: elimina los datos del proyecto remoto enlazado.
El archivo `seed.sql` es exclusivamente para desarrollo local y no se incluye
con `db push` mientras no se use `--include-seed`.

## Configurar la aplicación

Copiar `.env.example` a `.env.local` y usar solamente la URL y la publishable
key del proyecto móvil:

```dotenv
EXPO_PUBLIC_MOBILE_SUPABASE_URL=https://ID.supabase.co
EXPO_PUBLIC_MOBILE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Las variables `EXPO_PUBLIC_` quedan visibles dentro del APK. Por eso aquí nunca
debe colocarse una clave `sb_secret_`, `service_role`, token personal o contraseña.

Después de cambiar las variables, hacer una recarga completa de Expo:

```powershell
npx expo start --clear
```

## Desarrollo local

Con Docker Desktop activo:

```powershell
npx supabase start
npx supabase db reset
npx supabase status
```

`db reset` local recrea la base mediante las migraciones y carga `seed.sql`.
Los archivos de `supabase/migrations` son la fuente de verdad; no deben hacerse
cambios manuales directamente en el proyecto remoto.

## Importación inicial del historial

El script `scripts/import-mobile-history.mjs` lee las tablas públicas del
proyecto web y escribe filas normalizadas en `daily_rates`. Es idempotente y su
modo predeterminado es un dry-run. Las claves se pasan solo como variables del
proceso y nunca se imprimen ni se guardan en el repositorio.

```powershell
node scripts/import-mobile-history.mjs
node scripts/import-mobile-history.mjs --apply
```

Variables requeridas: `SOURCE_SUPABASE_URL`,
`SOURCE_SUPABASE_PUBLISHABLE_KEY`, `TARGET_SUPABASE_URL` y
`TARGET_SUPABASE_SECRET_KEY`. La clave secreta debe ser una clave nueva
`sb_secret_`; no se aceptan claves `service_role` heredadas.

## Ingesta automática

- `ingest-p2p`: se ejecuta a los 5 minutos de cada hora. Consulta Binance y
  Bybit, descarta valores atípicos y exige que ambos proveedores respondan.
- `ingest-bcv`: se ejecuta de lunes a viernes cada 30 minutos desde las 14:05
  hasta las 23:35, hora de Venezuela.
- Los reintentos BCV con la misma fecha y valores se registran como `skipped`;
  no duplican observaciones ni cambian el timestamp público.
- La configuración del cron vive en la migración
  `20260805000300_create_mobile_cron.sql`. URL y secreto se almacenan cifrados
  en Supabase Vault.

`BCV_FEED_URL` apunta al scraper/adaptador BCV existente en Vercel. Es la fuente
de ingesta requerida actualmente porque el sitio oficial del BCV no fue
accesible de forma confiable desde la Edge Function. La base móvil sigue siendo
independiente: solo consume la salida JSON del scraper y no comparte tablas ni
credenciales con la aplicación web.

Los RPC de escritura son `security definer`, usan un `search_path` vacío y solo
conceden ejecución a `service_role`. Las funciones HTTP requieren `POST` y el
encabezado privado `x-cron-secret`; nunca debe enviarse ese secreto desde la app.

Para forzar una actualización BCV desde el Dashboard sin revelar secretos, abrir
SQL Editor y ejecutar:

```sql
select private.trigger_bcv_ingestion();
```

La función devuelve el identificador de una solicitud asíncrona. El resultado de
la invocación puede revisarse en Edge Functions > `ingest-bcv` > Invocations.

## Push de nueva tasa BCV

Los Expo push tokens se almacenan en `public.device_push_tokens`, sin permisos de
lectura o escritura directa para clientes. El registro y la desactivación se
hacen mediante `register_device_push_token` y `disable_device_push_token`, que
aceptan un token concreto pero nunca permiten enumerar tokens ajenos.

`notificationService.ts` debe invocar estos RPC en lugar de escribir la tabla
directamente. Un `UPSERT` anónimo sobre una tabla RLS exige permiso de `SELECT`;
concederlo aquí expondría los tokens de otros dispositivos.

Un trigger sobre `public.daily_rates` detecta inserciones o cambios reales de
`bcv_usd`. Los reintentos sin cambios no generan notificaciones. Los mensajes se
envían a Expo en lotes de hasta 100 dispositivos y usan el canal Android
`bcv-alerts`. Las importaciones o correcciones de fechas pasadas tampoco envían
push.

## Separación respecto a la web

- La web continúa usando su repositorio, tablas y credenciales actuales.
- Mobile utiliza variables con el prefijo `EXPO_PUBLIC_MOBILE_`.
- No existe fallback hacia las variables antiguas.
- El historial se copió mediante una importación puntual; no existe una
  conexión permanente entre ambos proyectos.

## Referencias

- [Migraciones de base de datos](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase Vault](https://supabase.com/docs/guides/database/vault)
- [Programar Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)
- [Seguridad de Edge Functions](https://supabase.com/docs/guides/functions/auth)
- [Claves API nuevas de Supabase](https://supabase.com/docs/guides/getting-started/api-keys)
- [Expo SDK 56](https://docs.expo.dev/versions/v56.0.0/)
