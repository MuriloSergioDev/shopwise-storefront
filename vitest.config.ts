import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

// test/unit: plain Node (server utils, pure logic). test/nuxt: a Nuxt environment (components, composables).
// test/bff: builds the app and calls its Nitro server, with the services faked.
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', include: ['test/unit/**/*.test.ts'], environment: 'node' } },
      {
        test: { name: 'bff', include: ['test/bff/**/*.test.ts'], environment: 'node', hookTimeout: 300_000 },
      },
      await defineVitestProject({
        test: { name: 'nuxt', include: ['test/nuxt/**/*.test.ts'], environment: 'nuxt' },
      }),
    ],
  },
})
