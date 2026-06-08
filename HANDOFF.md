# Kuanto — Documento de traspaso (HANDOFF)

> Lee esto al retomar el proyecto en otra máquina. Resume el estado, las decisiones y cómo continuar. Complementa a `AGENTS.md` y `CLAUDE.md`.

## ▶️ Por dónde seguir (próxima sesión)

**Lo último hecho:** sección **Fuentes** con tasas en vivo (BCV + Binance/Bybit/Yadio), detrás del menú **☰** (arriba a la derecha del Home).

**Opciones para continuar** (elige una):

1. **Mis datos de pago móvil** — pantalla para guardar los datos de pago móvil del usuario (banco, cédula, teléfono) y poder copiarlos/compartirlos rápido. Hoy es un placeholder `ComingSoon` en `HomeScreen.tsx`; se abre desde `HeaderMenu.tsx` (clave `'pago'`). Persistir con AsyncStorage. **Es la opción recomendada para seguir.**
2. **Ajustes** — pantalla de ajustes (placeholder hoy, clave `'ajustes'`). Ideas: fuente/decimales, "Acerca de", enlaces.
3. **Ícono y splash** del rebranding — configurar en `app.json` (assets disponibles en el repo original: `icon.png`, `adaptive-icon.png`, `splash-icon.png`), o crear unos nuevos.

**Rutina:** antes de programar → `git pull`. Al terminar → `npx tsc --noEmit` y `npx expo export --platform ios` para verificar, luego `git add -A && git commit && git push`.

---

## Qué es

Reconstrucción **desde cero** en **React Native (Expo + TypeScript)** de la app de tasas de cambio **Kuanto** (rebranding), reusando el **backend Supabase** existente. Compatible iOS + Android. Tema oscuro/AMOLED con los colores de marca.

- Sitio original: kuanto.online · Repo web original (solo de referencia para APIs/assets): github.com/Aleneytor/Kuanto-App
- Se construye de forma incremental ("poco a poco").

## Stack y restricción importante

- **Expo SDK 54** (RN 0.81.5, React 19.1.0, TS 5.9). **NO subir de SDK** sin avisar: a mediados de 2026 el Expo Go de la App Store de iOS sólo soporta SDK 54; SDK 56 falla en iPhone físico ("versión incompatible"). SDK 54 también coincide con la app original.
- Navegación: por ahora **una sola pantalla** (Home). Las secciones (Fuentes/Ajustes/Pago móvil) se abren como **modales** desde un menú. React Navigation está instalado pero sin usar.
- Datos: `@supabase/supabase-js` (solo lectura, RLS). Iconos: `lucide-react-native` + SVG con `react-native-svg`. Input de moneda: `react-native-currency-input` (`FakeCurrencyInput`, evita el parpadeo del input controlado en iOS). Degradados: `expo-linear-gradient`. Portapapeles: `expo-clipboard`.

## Backend / datos (Supabase)

- Tablas: `bcv_rates_history` (date, usd, eur) y `p2p_rate_history` (price, details, created_at). `details` es JSON `{binance:{buy,sell}, bybit:{...}, yadio:{...}}`.
- Credenciales en `.env` (NO está en git; ver `.env.example`):
  - `EXPO_PUBLIC_SUPABASE_URL=https://goiaxsdsrwxlebpsnbrx.supabase.co`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>` — la `anon key` es pública por diseño (protegida por RLS). Cópiala desde `.env` de la otra máquina, o desde `src/database/supabaseClient.js` del repo original.

## Estado actual (hecho)

- **Home**: 3 tarjetas de tasas (USD BCV, EUR BCV, Paralelo USDT) desde Supabase, pull-to-refresh, caché offline (AsyncStorage), banner offline.
- **Tarjetas expandibles** (acordeón) con **calculadora integrada**: divisa arriba / Bs abajo, ambos campos editables (dos vías), formato de céntimos automático, arranca en **1,00**, botones **Copiar / Reiniciar / Compartir**. Animación con `Animated` (spring + interpolaciones memorizadas). Teclado solo al enfocar; la tarjeta se centra al enfocar.
- **Selector Hoy / próximo día** para calcular con la tasa BCV futura.
- **Gráfico de historial** (`HistoryChart.tsx`, SVG propio, sin librería): área + línea suave + tooltip al deslizar; selectores USD/EUR/USDT y Semana/Mes/Año (`HistorySection.tsx`, `fetchSeriesHistory`).
- **Menú** arriba a la derecha (`HeaderMenu.tsx`, modal) → **Fuentes / Mis datos de pago móvil / Ajustes**, abren `SectionModal.tsx` a pantalla completa.
- **Fuentes** (`SourcesScreen.tsx`): BCV (USD/EUR oficial + fecha) y Binance/Bybit/Yadio (Compra/Venta + "EN VIVO"), con logos reales (`assets/sources/*`, Binance vía `BinanceLogo.tsx`), cada uno abre su web.
- **Estética**: aura de acento en el tope (gradiente), profundidad/halo en tarjetas, indicador "en vivo", logo de Kuanto en el encabezado (`assets/kuanto-logo.png`), ícono USDT (`UsdtIcon.tsx`).

## Pendiente (siguiente)

- Construir **Mis datos de pago móvil** y **Ajustes** (hoy son placeholders "Próximamente").
- **Ícono y splash** de la app (rebranding) en `app.json` (assets en el repo original: icon.png, adaptive-icon.png, splash-icon.png).
- (Descartado por el usuario: tema claro.)

## Estructura

```
App.tsx                      # SafeAreaProvider > RatesProvider > HomeScreen
src/
  theme/colors.ts            # paleta de marca (oscuro)
  services/
    supabaseClient.ts        # cliente (lee .env)
    rateService.ts           # fetchAllRates (incluye p2p compra/venta) + fetchSeriesHistory
  context/RatesContext.tsx   # tasas + refresh + caché offline
  utils/formatting.ts        # formatCurrency, formatChange, parseAmount
  components/                # RateCard, HistoryChart, HistorySection, HeaderMenu,
                             # SectionModal, BinanceLogo, UsdtIcon
  screens/                   # HomeScreen, SourcesScreen
assets/                      # kuanto-logo.png, sources/ (bcv,bybit,yadio), icon/splash de Expo
```

## Cómo continuar en una máquina nueva

```bash
git clone <url-del-nuevo-repo> kuanto-rn
cd kuanto-rn
npm install
# crea .env (ver .env.example) con las dos variables EXPO_PUBLIC_SUPABASE_*
npx expo start            # escanea el QR con Expo Go (App Store / Play Store = SDK 54)
```

Verificación sin dispositivo: `npx tsc --noEmit` (tipos) y `npx expo export --platform ios` (empaquetado).

## Notas de Claude Code / contexto

- El historial de chat es local a cada máquina; este documento + `CLAUDE.md`/`AGENTS.md` son la fuente de contexto al retomar.
- Hay una "memoria automática" en `~/.claude/projects/<hash>/memory/` (local a la PC original) con las mismas decisiones; opcional copiarla.
- El usuario se comunica en **español**.
