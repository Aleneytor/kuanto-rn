import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_MOBILE_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_MOBILE_SUPABASE_PUBLISHABLE_KEY;

export const isMobileBackendConfigured = Boolean(supabaseUrl && supabasePublishableKey);

if (!isMobileBackendConfigured) {
  console.warn(
    '[Supabase Mobile] Falta la configuración del backend móvil. ' +
      'Copia .env.example a .env.local y agrega las credenciales públicas del proyecto nuevo.',
  );
}

/**
 * Cliente Supabase (solo lectura pública, protegido por RLS).
 * Sin sesión/login: la app solo consulta tablas de tasas.
 */
export const supabase = createClient(
  supabaseUrl ?? 'https://mobile-backend-not-configured.invalid',
  supabasePublishableKey ?? 'sb_publishable_mobile_backend_not_configured',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  },
);
