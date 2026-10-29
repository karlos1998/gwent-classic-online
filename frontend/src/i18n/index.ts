import { createI18n } from 'vue-i18n'
import en from './locales/en'
import pl from './locales/pl'
import { cardKey } from './keys'

export const LOCALES = ['en', 'pl'] as const
export type Locale = (typeof LOCALES)[number]

const STORAGE_KEY = 'gc-locale'

/** Saved choice first, otherwise the browser language (Polish -> pl, anything else -> en) */
function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && (LOCALES as readonly string[]).includes(saved)) return saved as Locale
  } catch {
    /* storage unavailable */
  }
  const langs = typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : []
  for (const l of langs) {
    const short = l?.toLowerCase().slice(0, 2)
    if ((LOCALES as readonly string[]).includes(short)) return short as Locale
  }
  return 'en'
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: detectLocale(),
  fallbackLocale: 'en',
  messages: { en, pl },
})

/** translate outside of components (stores, engine adapters, alerts) */
type TFn = (key: string, params?: Record<string, unknown>) => string
export const t = (key: string, params?: Record<string, unknown>): string =>
  params ? (i18n.global.t as unknown as TFn)(key, params) : (i18n.global.t as unknown as TFn)(key)

export const te = (key: string): boolean => (i18n.global.te as unknown as (k: string) => boolean)(key)

export function currentLocale(): Locale {
  return i18n.global.locale.value as Locale
}

function applyDocumentTexts() {
  if (typeof document === 'undefined') return
  document.documentElement.lang = currentLocale()
  document.title = t('meta.title')
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('meta.description'))
}

export function setLocale(locale: Locale) {
  i18n.global.locale.value = locale
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    /* ignore */
  }
  applyDocumentTexts()
}

applyDocumentTexts()

/** Displayed (translated) name of a card; the engine keeps the English name as identifier */
export const cardName = (name: string) => {
  const key = 'cards.' + cardKey(name)
  return te(key) ? t(key) : name
}

export const factionName = (faction: string) => t('factions.' + faction + '.name')
export const factionDescription = (faction: string) => t('factions.' + faction + '.description')
