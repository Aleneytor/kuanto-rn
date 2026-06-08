import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchAllRates, type Rates } from '../services/rateService';

const CACHE_KEY = '@kuanto/last_rates';

interface RatesContextValue {
  rates: Rates | null;
  loading: boolean; // carga inicial (aún no hay datos que mostrar)
  error: string | null;
  isStale: boolean; // mostrando datos cacheados porque la red falló (offline)
  refresh: () => Promise<void>;
}

const RatesContext = createContext<RatesContextValue | undefined>(undefined);

export function RatesProvider({ children }: { children: ReactNode }) {
  const [rates, setRates] = useState<Rates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const fresh = await fetchAllRates();
      setRates(fresh);
      setIsStale(false);
      setError(null);
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(fresh)).catch(() => {});
    } catch (e) {
      console.warn('[RatesContext] Error al cargar tasas:', e);
      setError('No se pudieron actualizar las tasas. Mostrando últimos datos conocidos.');
      // Caer a la caché si no hay nada en memoria
      const cached = await AsyncStorage.getItem(CACHE_KEY).catch(() => null);
      setRates((prev) => {
        if (prev) return prev;
        if (cached) {
          try {
            return JSON.parse(cached) as Rates;
          } catch {
            return prev;
          }
        }
        return prev;
      });
      setIsStale(true);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      // 1) Mostrar caché al instante (si existe)
      const cached = await AsyncStorage.getItem(CACHE_KEY).catch(() => null);
      if (cached && mounted) {
        try {
          setRates(JSON.parse(cached) as Rates);
        } catch {
          /* caché corrupta: ignorar */
        }
      }
      // 2) Refrescar desde la red
      await refresh();
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [refresh]);

  return (
    <RatesContext.Provider value={{ rates, loading, error, isStale, refresh }}>
      {children}
    </RatesContext.Provider>
  );
}

export function useRates(): RatesContextValue {
  const ctx = useContext(RatesContext);
  if (!ctx) {
    throw new Error('useRates debe usarse dentro de <RatesProvider>');
  }
  return ctx;
}
