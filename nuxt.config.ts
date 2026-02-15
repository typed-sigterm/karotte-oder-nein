const headers = {
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

export default defineNuxtConfig({
  modules: [
    '@nuxt/ui',
  ],

  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      title: 'Karotte oder Nein',
    },
  },

  css: ['~/main.css'],

  ssr: false,

  compatibilityDate: '2025-02-23',

  devServer: {
    port: 9808,
  },

  vite: {
    server: { headers },
    build: {
      // Baseline 2022 (China) - targets ES2020 for compatibility with:
      // Chrome 80+, Firefox 72+, Safari 13.1+, Edge 80+ which covers
      // the majority of browsers used in China market
      target: 'es2020',
    },
  },

  nitro: {
    routeRules: {
      '/**': { headers },
    },
  },

  fonts: {
    provider: 'bunny',
    providers: {
      google: false,
      googleicons: false,
    },
  },

  icon: {
    clientBundle: {
      scan: true,
    },
  },
});
