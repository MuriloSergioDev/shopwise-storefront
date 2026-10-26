// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@nuxt/ui', 'nuxt-auth-utils', '@nuxt/test-utils/module'],
  css: ['~/assets/css/main.css'],
  typescript: { strict: true },

  // Service base URLs are server-only: the browser only ever talks to this BFF.
  // Override with NUXT_IDENTITY_URL / NUXT_CATALOG_URL / NUXT_PRICING_URL / NUXT_CART_URL.
  runtimeConfig: {
    identityUrl: 'http://localhost:8101',
    catalogUrl: 'http://localhost:8102',
    pricingUrl: 'http://localhost:8104',
    cartUrl: 'http://localhost:8105',
  },

  // Pages render per request (they show the signed-in customer and their cart). Only public catalog reads are
  // cached; cart and price routes never are.
  routeRules: {
    '/cart': { ssr: true },
    '/api/catalog/categories': { cache: { swr: true, maxAge: 300 } },
    // One segment only: the search endpoint (/api/catalog/products) must not be cached.
    '/api/catalog/products/*': { cache: { swr: true, maxAge: 60 } },
  },
})
