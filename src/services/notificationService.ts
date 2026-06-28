import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { supabase } from './supabaseClient';

/**
 * Servicio de notificaciones de Kuanto.
 *
 * Dos tipos:
 *  1) Recordatorios USDT (LOCAL): 9:00 y 13:00 hora del dispositivo. Suaves,
 *     canal de baja importancia. Funcionan en Expo Go y en el build final.
 *  2) Alerta nueva tasa BCV (PUSH REMOTO): se dispara desde Supabase justo al
 *     insertarse la fila nueva. Requiere build propio + projectId de EAS (no
 *     funciona en Expo Go). El registro de token degrada con gracia: si no hay
 *     projectId, no registra nada y no rompe la app.
 */

// Identificadores estables para poder cancelar/reagendar sin duplicar.
export const USDT_AM_ID = 'kuanto-usdt-am';
export const USDT_PM_ID = 'kuanto-usdt-pm';
const USDT_ID_PREFIX = 'kuanto-usdt-';
// Días que pre-agendamos por adelantado (×2 slots/día = nº de notifs locales
// pendientes). iOS limita a 64 pendientes por app; con 14×2=28 queda amplio
// margen. La variedad NO depende de esto: messageForDate rota por fecha, así que
// igual se recorren los 30 mensajes a lo largo del tiempo. La ventana se re-topa
// en cada arranque (bootstrapNotifications).
const USDT_ROLLING_DAYS = 14;

// Canales Android.
const CH_USDT = 'usdt-reminders';
const CH_BCV = 'bcv-alerts';

// Claves de preferencias / token.
export const KEY_USDT = '@notif_usdt';
export const KEY_BCV = '@notif_bcv';
const KEY_TOKEN = '@notif_push_token';

const USDT_REMINDER_MESSAGES = [
  'Revisa cómo amanece el promedio USDT.',
  'Dale un vistazo rápido a la tasa de hoy.',
  'Kuanto tiene lista la referencia del día.',
  'Consulta el promedio antes de calcular.',
  'Ten la tasa a mano antes de cobrar.',
  'Mira el USDT de hoy en segundos.',
  'Actualiza tus cuentas con la tasa del día.',
  'Revisa el promedio antes de mover bolívares.',
  'La referencia cambió. Vale la pena mirarla.',
  'Abre Kuanto y confirma el promedio actual.',
  'Consulta BCV y USDT en un solo lugar.',
  'Revisa la referencia antes de vender.',
  'Calcula con la tasa más reciente.',
  'Dale una mirada al mercado de hoy.',
  'Tu referencia diaria está lista.',
  'Revisa el paralelo antes de hacer cuentas.',
  'Ten claro el cambio antes de decidir.',
  'Consulta la tasa antes de compartir montos.',
  'Abre Kuanto y revisa el promedio.',
  'La referencia del día ya está disponible.',
  'Mira cómo va el USDT hoy.',
  'Actualiza tus cálculos con Kuanto.',
  'Revisa la brecha entre BCV y USDT.',
  'Confirma la tasa antes de pagar o cobrar.',
  'Un vistazo rápido puede ahorrarte cuentas.',
  'Consulta la tasa antes del mediodía.',
  'El promedio USDT está listo para revisar.',
  'Ten tu calculadora de tasa al día.',
  'Revisa si el mercado se movió.',
  'Kuanto tiene la referencia actualizada.',
];

/**
 * Configura el handler (cómo se muestran las notifs en primer plano) y los
 * canales Android. Llamar una vez al arrancar la app (index.ts).
 */
export function configureHandlerAndChannels(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(CH_USDT, {
      name: 'Recordatorios USDT',
      importance: Notifications.AndroidImportance.DEFAULT, // suave, no intrusivo
      sound: 'default',
      vibrationPattern: [0, 120],
      lightColor: '#02DF82',
    }).catch(() => {});

    Notifications.setNotificationChannelAsync(CH_BCV, {
      name: 'Nueva tasa BCV',
      importance: Notifications.AndroidImportance.MAX, // la que de verdad importa
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#02DF82',
    }).catch(() => {});
  }
}

/** Pide permisos de notificación. Devuelve true si quedaron concedidos. */
export async function requestPermissions(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain && current.status === 'denied') return false;

    const req = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    return req.granted;
  } catch (err) {
    console.warn('[Notif] requestPermissions error:', err);
    return false;
  }
}

// --- Recordatorios USDT (local) ---

function nextLocalSlot(hour: number, minute: number): Date {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  if (date.getTime() <= Date.now()) date.setDate(date.getDate() + 1);
  return date;
}

function addLocalDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function messageForDate(date: Date, slotOffset: number): string {
  const dayIndex = Math.floor(date.getTime() / 86_400_000);
  const index = (dayIndex + slotOffset) % USDT_REMINDER_MESSAGES.length;
  return USDT_REMINDER_MESSAGES[index];
}

/** Cancela y reagenda recordatorios USDT alternados para los proximos 14 dias. */
export async function scheduleUsdtReminders(): Promise<void> {
  await cancelUsdtReminders();

  try {
    const slots = [
      { id: USDT_AM_ID, hour: 9, minute: 0, offset: 0 },
      { id: USDT_PM_ID, hour: 13, minute: 0, offset: 11 },
    ];

    for (const slot of slots) {
      const firstDate = nextLocalSlot(slot.hour, slot.minute);

      for (let day = 0; day < USDT_ROLLING_DAYS; day++) {
        const triggerDate = addLocalDays(firstDate, day);
        await Notifications.scheduleNotificationAsync({
          identifier: `${slot.id}-${day}`,
          content: {
            title: 'Promedio USDT',
            body: messageForDate(triggerDate, slot.offset),
            sound: 'default',
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: triggerDate,
            channelId: CH_USDT,
          },
        });
      }
    }
  } catch (err) {
    console.warn('[Notif] scheduleUsdtReminders error:', err);
  }
}

/** Cancela los recordatorios USDT. */
export async function cancelUsdtReminders(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((request) => request.identifier.startsWith(USDT_ID_PREFIX))
        .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
    );
    await Notifications.cancelScheduledNotificationAsync(USDT_AM_ID);
    await Notifications.cancelScheduledNotificationAsync(USDT_PM_ID);
  } catch {
    // ignore (puede no existir aún)
  }
}

// --- Alerta BCV (push remoto) ---

/**
 * Registra el dispositivo para el push del BCV: obtiene el Expo push token y lo
 * guarda en Supabase. Devuelve el token, o null si no es posible (Expo Go, sin
 * projectId, emulador, o permiso denegado). NUNCA lanza.
 */
export async function registerForBcvPush(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      console.warn('[Notif] Push solo funciona en dispositivo físico.');
      return null;
    }

    const granted = await requestPermissions();
    if (!granted) return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

    if (!projectId) {
      // Expo Go o proyecto sin EAS: el push remoto no aplica todavía.
      console.warn('[Notif] Sin projectId de EAS: registro de push omitido.');
      return null;
    }

    const tokenResp = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResp.data;
    if (!token) return null;

    await AsyncStorage.setItem(KEY_TOKEN, token);

    const { error } = await supabase.from('device_push_tokens').upsert(
      {
        token,
        platform: Platform.OS,
        enabled: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token' },
    );
    if (error) console.warn('[Notif] upsert token error:', error.message);

    return token;
  } catch (err) {
    console.warn('[Notif] registerForBcvPush error:', err);
    return null;
  }
}

/** Marca el token de este dispositivo como deshabilitado en Supabase (best-effort). */
export async function unregisterBcvPush(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(KEY_TOKEN);
    if (!token) return;
    await supabase
      .from('device_push_tokens')
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq('token', token);
  } catch (err) {
    console.warn('[Notif] unregisterBcvPush error:', err);
  }
}

// --- Tap de notificación ---

/**
 * Suscribe un handler que se llama cuando el usuario TOCA una notificación
 * (recordatorio USDT o push del BCV) con la app abierta o en segundo plano.
 * Útil para refrescar las tasas al abrir. Devuelve la función para desuscribir.
 * (El arranque en frío ya recarga solas las tasas vía RatesContext.)
 */
export function addNotificationTapHandler(onTap: () => void): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener(() => onTap());
  return () => sub.remove();
}

// --- Bootstrap al arrancar ---

/**
 * Re-arma las notificaciones según las preferencias guardadas. Llamar una vez
 * al montar la app: reagenda recordatorios (por si el SO los limpió) y refresca
 * el push token (puede cambiar entre versiones del SO). Idempotente y barato.
 */
export async function bootstrapNotifications(): Promise<void> {
  try {
    const [usdt, bcv] = await Promise.all([
      AsyncStorage.getItem(KEY_USDT),
      AsyncStorage.getItem(KEY_BCV),
    ]);
    if (usdt === 'true') await scheduleUsdtReminders();
    if (bcv === 'true') await registerForBcvPush();
  } catch (err) {
    console.warn('[Notif] bootstrap error:', err);
  }
}
