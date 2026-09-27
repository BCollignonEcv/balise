// https://nuxt.com/docs/api/configuration/nuxt-config
import { defaultTokensCss } from './utils/theme'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  // Application 100 % côté navigateur : la session Supabase vit dans le téléphone.
  ssr: false,

  devtools: { enabled: false },

  typescript: { strict: true },

  css: ['~/assets/css/base.css'],

  runtimeConfig: {
    public: {
      supabaseUrl: process.env.SUPABASE_URL ?? '',
      supabaseKey: process.env.SUPABASE_KEY ?? '',
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      title: 'Balise',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#F4EFE6' },
      ],
      // Thème par défaut (tokens) inscrit dans le HTML : présent partout, page d'erreur comprise.
      style: [{ key: 'default-tokens', innerHTML: defaultTokensCss() }],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..800&family=Instrument+Sans:wght@400..700&display=swap',
        },
      ],
    },
  },
})
