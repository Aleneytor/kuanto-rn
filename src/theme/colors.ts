/**
 * Paleta de Kuanto — portada del repo original (src/theme/colors.js).
 * Tema oscuro / AMOLED. El tema claro se añadirá en una iteración posterior.
 */
export const COLORS = {
  // Colores de marca (acentos)
  bcvGreen: '#02DF82',
  euroBlue: '#007AFF',
  parallelOrange: '#FF9500',

  // Tema oscuro (AMOLED)
  background: '#1c1c1e',
  card: '#2c2c2e',
  cardElevated: '#3a3a3c',
  text: '#ffffff',
  textSecondary: '#a1a1aa',
  divider: 'rgba(255,255,255,0.06)',
  glass: 'rgba(255,255,255,0.05)',
  glassStrong: 'rgba(255,255,255,0.10)',

  // Estados (variación de tasas)
  positive: '#02DF82',
  negative: '#FF453A',
} as const;

export type ColorName = keyof typeof COLORS;
