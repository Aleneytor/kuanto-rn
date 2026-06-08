/**
 * Utilidades de formato — portadas/ampliadas de src/utils/formatting.js (repo original).
 * Formato es-VE: punto como separador de miles, coma como separador decimal.
 */

/** Formatea un número a "1.234,56". Devuelve "0,00" para cero y "" para vacío/no numérico. */
export const formatCurrency = (value: number | string): string => {
  if (value === 0 || value === '0') return '0,00';
  if (!value && value !== 0) return '';

  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '';

  let [integer, decimal] = num.toFixed(2).split('.');

  // Separadores de miles
  integer = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `${integer},${decimal}`;
};

/**
 * Convierte el texto que escribe el usuario (formato es-VE, p. ej. "1.234,56")
 * a un número JS válido. Devuelve NaN si no es parseable.
 */
export const parseAmount = (text: string): number => {
  if (!text) return NaN;
  const normalized = text
    .trim()
    .replace(/\./g, '') // quita separadores de miles
    .replace(',', '.'); // coma decimal -> punto
  return parseFloat(normalized);
};

/** Formatea una variación porcentual con signo, p. ej. "+0,42%". */
export const formatChange = (change: number): string => {
  const sign = change > 0 ? '+' : '';
  return `${sign}${change.toFixed(2).replace('.', ',')}%`;
};
