import { beforeEach, describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import ProductsPage from '~/pages/products/index.vue'

const product = (slug: string, name: string) => ({
  id: slug,
  slug,
  name,
  category: { id: 'tops', slug: 'tops', name: 'Tops' },
  image: null,
})

describe('products page', () => {
  beforeEach(() => clearNuxtData())

  it('lists products with their facets', async () => {
    registerEndpoint('/api/catalog/products', () => ({
      data: [product('merino-crew-tee', 'Merino Crew Tee'), product('linen-camp-shirt', 'Linen Camp Shirt')],
      meta: { page: 1, perPage: 12, total: 2, lastPage: 1 },
      facets: {
        categories: [{ slug: 'tops', name: 'Tops', count: 2 }],
        options: [{ name: 'color', values: [{ value: 'Black', count: 1 }] }],
      },
    }))

    const page = await mountSuspended(ProductsPage, { route: '/products' })

    expect(page.text()).toContain('2 products')
    expect(page.text()).toContain('Merino Crew Tee')
    expect(page.text()).toContain('Linen Camp Shirt')
    expect(page.text()).toContain('Black (1)')
  })

  it('shows an error instead of an empty list when catalog is down', async () => {
    registerEndpoint('/api/catalog/products', () => {
      throw createError({ statusCode: 502, statusMessage: 'The catalog service is unavailable.' })
    })

    const page = await mountSuspended(ProductsPage, { route: '/products?q=down' })

    expect(page.text()).toContain('Products could not be loaded.')
    expect(page.text()).not.toContain('No products match')
  })
})
