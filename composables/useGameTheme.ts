import type { MaybeRefOrGetter } from 'vue'

/**
 * Applique le thème d'une partie : renvoie les variables CSS à poser sur la
 * racine des pages participant et charge les polices Google nécessaires.
 */
export function useGameTheme(theme: MaybeRefOrGetter<GameTheme | null | undefined>) {
  const tokens = computed(() => toValue(theme)?.tokens ?? {})
  const style = computed(() => tokensToCssVars(tokens.value))
  const fontsHref = computed(() => themeFontsHref(tokens.value))

  useHead(() => ({
    link: fontsHref.value ? [{ key: 'game-fonts', rel: 'stylesheet', href: fontsHref.value }] : [],
  }))

  return { style }
}
