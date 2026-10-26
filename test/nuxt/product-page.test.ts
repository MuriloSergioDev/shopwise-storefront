import { beforeEach, describe, expect, it } from 'vitest'
import { readBody } from 'h3'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import ProductPage from '~/pages/products/[slug].vue'

const variant = (sku: string, size: string) => ({
  id: sku,
  sku,
  name: `Black / ${size}`,
  options: { color: 'Black', size },
  active: true,
})

const product = {
  id: 'p1',
  slug: 'merino-crew-tee',
  name: 'Merino Crew Tee',
  description: 'Soft.',
  category: { id: 'tops', slug: 'tops', name: 'Tops' },
  images: [],
  variants: [variant('TEE-BLK-M', 'M'), variant('TEE-BLK-L', 'L')],
}

describe('product page', () => {
  beforeEach(() => clearNuxtData())

  it("shows the selected variant's price and adds it to the cart", async () => {
    const added: unknown[] = []
    registerEndpoint('/api/catalog/products/merino-crew-tee', () => ({ data: product }))
    registerEndpoint('/api/pricing/prices', () => ({
      data: [
        { sku: 'TEE-BLK-M', amount: 4500, currency: 'USD' },
        { sku: 'TEE-BLK-L', amount: 4900, currency: 'USD' },
      ],
    }))
    registerEndpoint('/api/cart/items', {
      method: 'POST',
      handler: async (event) => {
        added.push(await readBody(event))

        return { data: { itemCount: 1 } }
      },
    })

    const page = await mountSuspended(ProductPage, { route: '/products/merino-crew-tee' })

    expect(page.find('[data-test="price"]').text()).toBe('$45.00')

    const large = page.findAll('button').find((button) => button.text() === 'L')!
    await large.trigger('click')
    expect(page.find('[data-test="price"]').text()).toBe('$49.00')

    const add = page.findAll('button').find((button) => button.text().includes('Add to cart'))!
    await add.trigger('click')
    await flushPromises()
    expect(added).toEqual([{ sku: 'TEE-BLK-L', quantity: 1 }])
  })

  it('cannot add a variant without a price', async () => {
    registerEndpoint('/api/catalog/products/merino-crew-tee', () => ({ data: product }))
    registerEndpoint('/api/pricing/prices', () => ({ data: [] }))

    const page = await mountSuspended(ProductPage, { route: '/products/merino-crew-tee' })

    expect(page.find('[data-test="price"]').text()).toBe('Price unavailable')
    const add = page.findAll('button').find((button) => button.text().includes('Add to cart'))!
    expect(add.attributes('disabled')).toBeDefined()
  })
})
