import browserslistToEsbuild from 'browserslist-to-esbuild';
import { browserslistToTargets } from 'lightningcss';
import { browserslist } from './package.json';

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
    resolve: {
      dedupe: [
        '@vueuse/core',
        '@vueuse/shared',
      ],
    },
    build: {
      target: browserslistToEsbuild(browserslist),
    },
    css: {
      lightningcss: {
        targets: browserslistToTargets(browserslist),
      },
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
