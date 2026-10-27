import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import CartPage from '~/pages/cart.vue'
import CartButton from '~/components/CartButton.vue'
import type { CartView } from '#shared/types/cart'

const view = (overrides: Partial<CartView> = {}): CartView => ({
  owner: 'guest',
  itemCount: 3,
  currency: 'USD',
  couponCode: null,
  coupon: null,
  lockedByCheckoutId: null,
  totals: { subtotal: 10800, discount: 0, total: 10800 },
  lines: [
    {
      sku: 'TEE-BLK-M',
      quantity: 2,
      productSlug: 'merino-crew-tee',
      productName: 'Merino Crew Tee',
      variantName: 'Black / M',
      available: true,
      unitAmount: 4500,
      lineAmount: 9000,
    },
    {
      sku: 'MUG-WHT',
      quantity: 1,
      productSlug: 'stoneware-mug',
      productName: 'Stoneware Mug',
      variantName: 'White',
      available: true,
      unitAmount: 1800,
      lineAmount: 1800,
    },
  ],
  ...overrides,
})

describe('cart page', () => {
  it('is read-only while a checkout holds the cart, with a link to it', async () => {
    clearNuxtData()
    registerEndpoint('/api/cart', () => ({ data: view({ owner: 'customer', lockedByCheckoutId: 'checkout-9' }) }))

    const page = await mountSuspended(CartPage, { route: '/cart' })

    expect(page.find('[data-test="cart-locked"]').text()).toContain('Your cart is being checked out.')
    expect(page.find('a[href="/checkout/checkout-9"]').exists()).toBe(true)
    const remove = page.findAll('button').find((button) => button.attributes('aria-label')?.startsWith('Remove'))!
    expect(remove.attributes('disabled')).toBeDefined()
    expect(page.find('input[aria-label="Coupon code"]').attributes('disabled')).toBeDefined()
  })

  beforeEach(() => clearNuxtData())

  it('lists the lines with money formatted from minor units, and the totals', async () => {
    registerEndpoint('/api/cart', () => ({ data: view() }))

    const page = await mountSuspended(CartPage, { route: '/cart' })

    expect(page.text()).toContain('Merino Crew Tee')
    expect(page.text()).toContain('$45.00 each')
    expect(page.text()).toContain('$90.00')
    expect(page.text()).toContain('$108.00')
  })

  it('shows the discount and why a coupon does not apply', async () => {
    registerEndpoint('/api/cart', () => ({
      data: view({
        couponCode: 'BIGSPEND',
        coupon: {
          code: 'BIGSPEND',
          valid: false,
          reason: 'min_subtotal_not_met',
          message: 'Your order does not reach the minimum for this coupon yet.',
          description: null,
        },
      }),
    }))

    const page = await mountSuspended(CartPage, { route: '/cart' })

    expect(page.find('[data-test="coupon-message"]').text()).toBe(
      'Your order does not reach the minimum for this coupon yet.',
    )
    expect(page.text()).not.toContain('Discount')
  })

  it('removes a line and shows the updated cart', async () => {
    registerEndpoint('/api/cart', () => ({ data: view() }))
    registerEndpoint('/api/cart/items/MUG-WHT', {
      method: 'DELETE',
      handler: () => ({ data: view({ itemCount: 2, lines: view().lines.slice(0, 1) }) }),
    })

    const page = await mountSuspended(CartPage, { route: '/cart' })
    await page.find('button[aria-label="Remove White"]').trigger('click')
    await flushPromises()

    expect(page.text()).not.toContain('Stoneware Mug')
  })

  it('says when the cart is empty', async () => {
    registerEndpoint('/api/cart', () => ({ data: view({ itemCount: 0, lines: [] }) }))

    const page = await mountSuspended(CartPage, { route: '/cart' })

    expect(page.text()).toContain('Your cart is empty.')
  })

  it('counts items in the header badge', async () => {
    registerEndpoint('/api/cart', () => ({ data: view() }))

    const button = await mountSuspended(CartButton)
    await flushPromises()

    expect(button.text()).toContain('3')
    expect(button.find('a[aria-label="Cart, 3 items"]').exists()).toBe(true)
  })
})
