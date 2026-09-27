/**
 * Design system : tokens surchargeables par partie.
 *
 * DEFAULT_TOKENS est la source unique du thème par défaut. Chaque clé devient
 * une variable CSS (`color-primary` → `--color-primary`). Un thème de partie ne
 * stocke que les tokens qu'il surcharge ; les autres reprennent la valeur par défaut.
 */

export const DEFAULT_TOKENS = {
  // Couleurs de base
  'color-bg': '#F4EFE6',
  'color-surface': '#FFFDF8',
  'color-text': '#1F2A24',
  'color-text-muted': '#5B625D',
  'color-border': '#DED6C7',
  'color-primary': '#C2410C',
  'color-on-primary': '#FFFFFF',
  'color-secondary': '#0F5E63',
  'color-on-secondary': '#FFFFFF',

  // Statuts (fond / texte)
  'status-todo-bg': '#EAE4D8',
  'status-todo-fg': '#4A504C',
  'status-pending-bg': '#FDF0D5',
  'status-pending-fg': '#8A4B08',
  'status-validated-bg': '#DCEBEC',
  'status-validated-fg': '#0B4A4E',
  'status-refused-bg': '#F8E1E4',
  'status-refused-fg': '#9F1239',

  // Typographies (nom de famille Google Fonts)
  'font-heading': 'Fraunces',
  'font-body': 'Instrument Sans',

  // Cartes mission (« var(…) » : suit automatiquement la couleur de base)
  'card-bg': 'var(--color-surface)',
  'card-bg-image': 'none',
  'card-border-width': '1px',
  'card-border-color': 'var(--color-border)',
  'card-radius': '16px',
  'card-shadow': 'none',

  // Badge de points
  'badge-points-bg': 'var(--color-primary)',
  'badge-points-fg': 'var(--color-on-primary)',
  'badge-points-radius': '999px',

  // Page
  'page-bg-image': 'none',
  'page-bg-size': 'cover',
  'page-bg-repeat': 'no-repeat',
} as const

export type TokenName = keyof typeof DEFAULT_TOKENS
export type ThemeTokens = Partial<Record<TokenName, string>>

/** Thème d'une partie, tel que stocké en base (colonne games.theme). */
export interface GameTheme {
  tokens?: ThemeTokens
  logoUrl?: string | null
  headerImageUrl?: string | null
}

const FONT_FALLBACKS: Partial<Record<TokenName, string>> = {
  'font-heading': 'Georgia, serif',
  'font-body': 'system-ui, sans-serif',
}

function cssValue(name: TokenName, value: string): string {
  const fallback = FONT_FALLBACKS[name]
  return fallback ? `'${value}', ${fallback}` : value
}

/** Ne garde que les tokens qui diffèrent du thème par défaut (ce qui est stocké en base). */
export function tokenOverrides(tokens: Record<TokenName, string>): ThemeTokens {
  const overrides: ThemeTokens = {}
  for (const name of Object.keys(DEFAULT_TOKENS) as TokenName[]) {
    const value = tokens[name]?.trim()
    if (value && value !== DEFAULT_TOKENS[name]) overrides[name] = value
  }
  return overrides
}

/** Thème complet : valeurs par défaut + surcharges. */
export function resolveTokens(overrides: ThemeTokens = {}): Record<TokenName, string> {
  return { ...DEFAULT_TOKENS, ...overrides }
}

/** Neutralise une éventuelle balise </style> dans le CSS personnalisé. */
export function sanitizeCustomCss(css: string | null | undefined): string {
  return (css ?? '').replace(/<\/?style/gi, '')
}

/** Variables CSS à appliquer pour un ensemble de tokens (surcharges uniquement si `tokens` est partiel). */
export function tokensToCssVars(tokens: ThemeTokens): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const [name, value] of Object.entries(tokens) as [TokenName, string | undefined][]) {
    if (value) vars[`--${name}`] = cssValue(name, value)
  }
  return vars
}

/** Bloc `:root { … }` du thème par défaut. */
export function defaultTokensCss(): string {
  const body = Object.entries(tokensToCssVars(DEFAULT_TOKENS))
    .map(([k, v]) => `${k}:${v};`)
    .join('')
  return `:root{${body}}`
}

/**
 * Polices Google proposées dans l'éditeur de thème, avec leurs graisses
 * disponibles (Google refuse toute la requête si une graisse n'existe pas).
 */
export const FONT_CATALOG: Record<string, { category: 'serif' | 'sans' | 'display' | 'hand'; weights: number[] }> = {
  'Fraunces': { category: 'serif', weights: [400, 500, 600, 700, 800] },
  'Instrument Sans': { category: 'sans', weights: [400, 500, 600, 700] },
  'Playfair Display': { category: 'serif', weights: [400, 500, 600, 700, 800] },
  'Merriweather': { category: 'serif', weights: [400, 700] },
  'Lora': { category: 'serif', weights: [400, 500, 600, 700] },
  'Inter': { category: 'sans', weights: [400, 500, 600, 700, 800] },
  'Nunito': { category: 'sans', weights: [400, 500, 600, 700, 800] },
  'Poppins': { category: 'sans', weights: [400, 500, 600, 700, 800] },
  'Work Sans': { category: 'sans', weights: [400, 500, 600, 700, 800] },
  'Baloo 2': { category: 'display', weights: [400, 500, 600, 700, 800] },
  'Bebas Neue': { category: 'display', weights: [400] },
  'Righteous': { category: 'display', weights: [400] },
  'Luckiest Guy': { category: 'display', weights: [400] },
  'Caveat': { category: 'hand', weights: [400, 500, 600, 700] },
  'Permanent Marker': { category: 'hand', weights: [400] },
}

/** URL Google Fonts pour les polices d'un thème qui diffèrent des polices par défaut. */
export function themeFontsHref(tokens: ThemeTokens = {}): string | null {
  const defaults: string[] = [DEFAULT_TOKENS['font-heading'], DEFAULT_TOKENS['font-body']]
  const families = [tokens['font-heading'], tokens['font-body']]
    .filter((f): f is string => !!f && !defaults.includes(f))
  if (!families.length) return null
  const params = [...new Set(families)]
    .map((f) => {
      const name = encodeURIComponent(f).replace(/%20/g, '+')
      const weights = FONT_CATALOG[f]?.weights
      return weights && weights.length > 1 ? `family=${name}:wght@${weights.join(';')}` : `family=${name}`
    })
    .join('&')
  return `https://fonts.googleapis.com/css2?${params}&display=swap`
}
