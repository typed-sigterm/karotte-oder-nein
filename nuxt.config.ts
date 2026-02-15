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
      target: 'es2020', // Baseline 2022 (China) compatible target
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
