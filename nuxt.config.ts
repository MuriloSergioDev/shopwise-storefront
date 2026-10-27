// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', '@nuxt/ui', 'nuxt-auth-utils', '@nuxt/test-utils/module'],
  css: ['~/assets/css/main.css'],
  typescript: { strict: true },

  // Service base URLs are server-only: the browser only ever talks to this BFF.
  // Override with NUXT_IDENTITY_URL / NUXT_CATALOG_URL / NUXT_PRICING_URL / NUXT_CART_URL / NUXT_CHECKOUT_URL /
  // NUXT_ORDERS_URL.
  runtimeConfig: {
    identityUrl: 'http://localhost:8101',
    catalogUrl: 'http://localhost:8102',
    pricingUrl: 'http://localhost:8104',
    cartUrl: 'http://localhost:8105',
    checkoutUrl: 'http://localhost:8106',
    ordersUrl: 'http://localhost:8108',
    tracing: {
      // OTLP/HTTP collector for the BFF's spans (NUXT_TRACING_EXPORTER_URL). `nuxt dev` uses the cluster's (Tilt
      // forwards :4318); builds export nothing unless it is set.
      exporterUrl: process.env.NODE_ENV === 'production' ? '' : 'http://localhost:4318',
    },
    public: {
      // NUXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (pk_test_�): the payment step uses Stripe's Payment Element. Without it,
      // and only when test cards are allowed (NUXT_PUBLIC_TEST_CARDS, on in `nuxt dev`), it offers Stripe's test
      // payment methods for payments' fake gateway.
      stripePublishableKey: '',
      testCards: process.env.NODE_ENV !== 'production',
    },
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
