# Kuanto — Documento de traspaso (HANDOFF)

> Lee esto al retomar el proyecto en otra máquina. Resume el estado, las decisiones y cómo continuar. Complementa a `AGENTS.md` y `CLAUDE.md`.

## ▶️ Por dónde seguir (próxima sesión)

**Estado:** App funcional y fluida. Home estilo web (calculadora, calendario, historial, brecha del día), **Mis datos** reconstruida (pantalla nativa, sin lag), **Historial Completo** (lista + export a Excel, con caché), **compartir tasa + método de pago** arreglado, **Fuentes** y **Ajustes**. Verificado con `npm run typecheck` + `npx expo export --platform ios`.

**Antes de empezar:** `git pull`. **Ojo:** `npx tsc --noEmit` **crashea** por un bug de pila de Node v25; usa el script nuevo **`npm run typecheck`** (aplica `--stack-size=8000`).

**Pendientes (elige uno):**

1. **Tutorial de bienvenida (onboarding)** en el primer arranque que lleve al usuario a **cargar sus datos de pago móvil** (`PagoMovilScreen`). Detectar "primera vez" con un flag en AsyncStorage (p. ej. `@onboarding_done`) y abrir la sección `'pago'` o un mini paso a paso. *(Pedido por el usuario.)*
2. **Notificaciones reales**: hoy el toggle de Ajustes solo guarda la preferencia en AsyncStorage. Implementar con `expo-notifications` (avisos de nueva tasa BCV / movimiento del paralelo). *(Pedido por el usuario.)*
3. **Vista diaria de USDT en Supabase** para que el **Historial Completo cargue rápido la primera vez**: hoy baja miles de ticks P2P y los promedia en el cliente. Crear una vista/RPC que devuelva el promedio diario ya calculado y consumirla desde `rateService`. Requiere correr SQL en el panel de Supabase (la `anon key` es de solo lectura).
4. **Ícono y splash** de la app (rebranding) en `app.json`. Assets en el repo web original: `icon.png`, `adaptive-icon.png`, `splash-icon.png`.
5. **Compartir tasa histórica** desde el calendario (hoy solo consulta).

**Rutina:** `git pull` → programar → `npm run typecheck` → `git add -A && git commit && git push`.

---

## 🗓️ Changelog

### Sesión 2026-06-08 — rendimiento, arreglos y "Mis datos" v2

**Arreglos:**
- **Compartir tasa + método de pago**: el share no se disparaba (el `useEffect` cancelaba su propio `setTimeout` en el cleanup). Reescrito con `useRef` + `onDismiss` del modal (iOS) y respaldo por timeout (`RateCard.tsx`, `PaymentSelectionModal.tsx`).
- **Typecheck**: `tsc` no compilaba por trabajo en curso — clave `history` faltante en `SECTION_TITLES`; API vieja de `expo-file-system` en `exportService` → import desde `expo-file-system/legacy` (SDK 54); carpeta de referencia `temp_kuanto_web/` excluida de `tsconfig` + `.gitignore`.

**"Mis datos" reconstruida (v2):** la versión previa (1521 líneas, hoja `SheetModal` con `expo-blur`) lagueaba al abrir. Reescrita ligera (`PagoMovilScreen.tsx`, ~1090 líneas) y presentada en el **`SectionModal` nativo** (como Fuentes/Ajustes, sin lag); buscador de banco como **overlay en pantalla** (no Modal anidado); barra **"Listo"** sobre el teclado numérico (iOS, `InputAccessoryView`) + cerrar al deslizar. Se **borró `SheetModal.tsx`** y la dependencia **`expo-blur`**. El modelo de datos (`banks.ts`) y `PaymentSelectionModal` quedaron intactos → el compartir tasa+método sigue igual.

**Historial Completo más rápido:** bajaba miles de ticks P2P en **cada** apertura, sin caché. Ahora: **caché** en AsyncStorage (muestra al instante, refresca en 2º plano solo si >15 min), consulta **diferida** tras la animación de apertura, y **ventana de 21 días** (no 30). `rateService` ganó un parámetro opcional `fromDateOverride`. Pendiente real para la 1ª carga: agregación diaria en Supabase (ver "Por dónde seguir" #3). Archivos: `HistoryModal.tsx`, `rateService.ts`.

**Infra:** script **`npm run typecheck`** (`node --stack-size=8000 … tsc --noEmit`) por el crash de pila de Node v25. Este commit también consolida el trabajo previo sin commitear: **Historial Completo** (`HistoryModal.tsx`), **export a Excel** (`exportService.ts`, `xlsx` + `expo-sharing` + `expo-file-system`) y **Ajustes**.

### Sincronización 2026-06 (trabajo multi-agente)

> **Estado base al iniciar:** commit `b104fdb`, con bastante trabajo **sin commitear** de agentes previos en el árbol (nuevas pantallas y assets). Varios agentes trabajaron sobre el mismo código; lo de abajo es el estado **acumulado** que se consolidó en este commit de sincronización. No todo es atribuible a una sola sesión.

**Pantallas y funciones nuevas (agentes previos, estaban sin commitear):**
- **Mis datos de pago** — `screens/PagoMovilScreen.tsx`, `constants/banks.ts`, `assets/banks/`. Guarda métodos de **pago móvil** o **transferencia**: 27 bancos venezolanos con logo, validación de cédula/RIF, teléfono (11 díg., 04…) y cuenta (20 díg., prefijo = código de banco). Lista con campos copiables + compartir; formulario con buscador de banco. Persiste en AsyncStorage (`@payment_methods_data`).
- **Ajustes** — `screens/SettingsScreen.tsx`. Notificaciones (toggle persistido), enlaces (sitio web, compartir app, calificar), soporte (correo) y **aviso legal** expandible.
- **Brecha de hoy** — `components/CurrencyGap.tsx`. Diferencias BCV↔EUR, EUR↔USDT, USDT↔BCV en Bs con %.
- **Compartir con método de pago** — `components/PaymentSelectionModal.tsx`. Al compartir una tasa permite anexar un método de pago guardado al mensaje.

**Esta sesión (rediseño + calendario + pulido):**
- **Rediseño visual del Home** para parecerse a la web: valor de la tasa en **color de acento** + sufijo **"Bs."**, botón de compartir **siempre visible** en la tarjeta, etiqueta `TASA BCV (USD)`, badge **"EN VIVO"** con punto pulsante, toggle Hoy/próximo en **verde sólido**, etiquetas de sección, `ACTIVIDAD HISTÓRICA` con icono.
- **Sistema de calendario** — `components/CalendarModal.tsx` + `fetchRatesByDate()` en `rateService.ts`. Botón **arriba-izquierda** (header de 3 columnas: calendario · logo · menú). Calendario propio (sin librería); busca la tasa BCV/USDT vigente en una fecha pasada (si el BCV no publicó ese día, muestra la última vigente y lo avisa).
- **Compartir tasa + método de pago (corregido)** — el share sheet nativo no aparecía si se cerraba un `Modal` justo antes. Solución en `RateCard.tsx`: guardar la selección en estado (`pendingMethod`) + `useEffect` que dispara el share una vez cerrado el modal.
- **Calculadora** — al tocar un campo se limpia el `1,00` por defecto para escribir directo (flag `touched`, conserva montos ya escritos); el teclado se cierra al colapsar la tarjeta.
- **Historial** — el título `ACTIVIDAD HISTÓRICA` se salía del borde; ahora título arriba + selector de serie (BCV USD / BCV EUR / USDT) como **control segmentado** de ancho completo.
- **Menú sin delay** — `HeaderMenu` pasó de `Modal` nativo a **overlay dentro de la vista**; abrir una sección ya no espera a que se cierre el modal del menú.
- **"Mis datos" como hoja inferior con fondo difuminado** — `components/SheetModal.tsx` + **`expo-blur`**. El Home queda **visible y borroso** detrás. Se renderiza como overlay en la **misma capa** (un `BlurView` dentro de un `Modal` nativo no difumina lo de fuera). Panel **translúcido** para no tapar el Home con negro; `PagoMovilScreen` con fondo transparente.
- **Scroll** — al **cerrar** una tarjeta la vista se recoloca sobre ella (antes quedabas "perdido" al reacomodarse el contenido).
- **Indicador "Próxima publicación"** discreto (icono + texto gris) para igualar al de "EN VIVO".

**Dependencia añadida:** `expo-blur@~15.0.8` (incluida en Expo Go; no requiere build nativo).

---

## Qué es

Reconstrucción **desde cero** en **React Native (Expo + TypeScript)** de la app de tasas de cambio **Kuanto** (rebranding), reusando el **backend Supabase** existente. Compatible iOS + Android. Tema oscuro/AMOLED con los colores de marca.

- Sitio original: kuanto.online · Repo web original (solo de referencia para APIs/assets): github.com/Aleneytor/Kuanto-App
- Se construye de forma incremental ("poco a poco").

## Stack y restricción importante

- **Expo SDK 54** (RN 0.81.5, React 19.1.0, TS 5.9). **NO subir de SDK** sin avisar: a mediados de 2026 el Expo Go de la App Store de iOS sólo soporta SDK 54; SDK 56 falla en iPhone físico ("versión incompatible"). SDK 54 también coincide con la app original.
- Navegación: por ahora **una sola pantalla** (Home). Las secciones se abren como **modales/hojas** desde el menú (☰) y el botón de calendario. React Navigation está instalado pero sin usar.
- Datos: `@supabase/supabase-js` (solo lectura, RLS). Iconos: `lucide-react-native` + SVG con `react-native-svg`. Input de moneda: `react-native-currency-input` (`FakeCurrencyInput`). Degradados: `expo-linear-gradient`. Portapapeles: `expo-clipboard`. **Desenfoque: `expo-blur`** (hoja "Mis datos"). Persistencia local: `@react-native-async-storage/async-storage`.

## Backend / datos (Supabase)

- Tablas: `bcv_rates_history` (date, usd, eur) y `p2p_rate_history` (price, details, created_at). `details` es JSON `{binance:{buy,sell}, bybit:{...}, yadio:{...}}`.
- Credenciales en `.env` (**incluido en el repo**; la `anon key` es pública por diseño, protegida por RLS):
  - `EXPO_PUBLIC_SUPABASE_URL=https://goiaxsdsrwxlebpsnbrx.supabase.co`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>` — pública por diseño (protegida por RLS). Cópiala desde `.env` de la otra máquina si falta.

## Estado actual (hecho)

- **Home**: 3 tarjetas de tasas (USD BCV, EUR BCV, Paralelo USDT) desde Supabase, pull-to-refresh, caché offline (AsyncStorage), banner offline. Header de 3 columnas: **calendario · logo · menú**.
- **Tarjetas expandibles** (acordeón) con **calculadora integrada**: divisa arriba / Bs abajo, ambos campos editables, formato de céntimos, arranca en **1,00** (se limpia al escribir), botones **Copiar / Reiniciar** y **Compartir** (con selección opcional de método de pago). Valor en color de acento + "Bs.".
- **Selector Hoy / próximo día** para calcular con la tasa BCV futura (indicador "Próxima publicación").
- **Calendario** (`CalendarModal.tsx`): buscar la tasa BCV/USDT vigente en cualquier fecha pasada.
- **Gráfico de historial** (`HistoryChart.tsx`, SVG propio): área + línea + tooltip; selector de serie segmentado y Semana/Mes/Año (`HistorySection.tsx`).
- **Brecha de hoy** (`CurrencyGap.tsx`).
- **Menú** (☰) → **Fuentes / Mis datos / Ajustes**.
- **Fuentes** (`SourcesScreen.tsx`): BCV + Binance/Bybit/Yadio (Compra/Venta), logos reales.
- **Mis datos** (`PagoMovilScreen.tsx`) en **hoja inferior** (`SheetModal.tsx`) con Home difuminado.
- **Ajustes** (`SettingsScreen.tsx`).

## Pendiente (siguiente)

- **Ícono y splash** de la app (rebranding) en `app.json` (assets en el repo original).
- Pulir altura de la hoja "Mis datos" (ajustar a contenido).
- Compartir tasa histórica desde el calendario.
- Notificaciones reales.
- (Descartado por el usuario: tema claro.)

## Estructura

```
App.tsx                      # SafeAreaProvider > RatesProvider > HomeScreen
src/
  theme/colors.ts            # paleta de marca (oscuro)
  constants/banks.ts         # 27 bancos VE (código/nombre/logo) + tipos PaymentMethod/Bank/AccountType
  services/
    supabaseClient.ts        # cliente (lee .env)
    rateService.ts           # fetchAllRates + fetchSeriesHistory + fetchRatesByDate (calendario)
  context/RatesContext.tsx   # tasas + refresh + caché offline
  utils/formatting.ts        # formatCurrency, formatChange, parseAmount
  components/                # RateCard, HistoryChart, HistorySection, HeaderMenu (overlay),
                             # SectionModal, SheetModal (hoja+blur), CalendarModal,
                             # CurrencyGap, PaymentSelectionModal, BinanceLogo, UsdtIcon
  screens/                   # HomeScreen, SourcesScreen, PagoMovilScreen, SettingsScreen
assets/                      # kuanto-logo.png, sources/, banks/ (logos de bancos), icon/splash de Expo
```

## Cómo continuar en una máquina nueva

```bash
git clone https://github.com/Aleneytor/kuanto-rn
cd kuanto-rn
npm install                  # instala dependencias (incluye expo-blur)
# .env ya viene incluido en el repo (claves de Supabase públicas por RLS)
npx expo start               # escanea el QR con Expo Go (App Store / Play Store = SDK 54)
```

Verificación sin dispositivo: `npx tsc --noEmit` (tipos) y `npx expo export --platform ios` (empaquetado).

## Notas de Claude Code / contexto

- El historial de chat es local a cada máquina; este documento + `CLAUDE.md`/`AGENTS.md` son la fuente de contexto al retomar.
- **Trabajo multi-agente:** varias sesiones/agentes han tocado este árbol. Al sincronizar, revisa `git log` y este changelog antes de asumir quién hizo qué.
- El usuario se comunica en **español**.
```
