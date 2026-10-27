import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import CheckoutPage from '~/pages/checkout/index.vue'
import CheckoutStatusPage from '~/pages/checkout/[id].vue'
import OrdersPage from '~/pages/orders/index.vue'
import OrderPage from '~/pages/orders/[id].vue'
import type { CartView } from '#shared/types/cart'
import type { Checkout, Order } from '#shared/types/contracts'

const cart: CartView = {
  owner: 'customer',
  itemCount: 1,
  currency: 'USD',
  couponCode: 'WELCOME10',
  coupon: { code: 'WELCOME10', valid: true, reason: null, message: null, description: '10% off' },
  lockedByCheckoutId: null,
  totals: { subtotal: 1800, discount: 180, total: 1620 },
  lines: [
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
}

const checkout = (overrides: Partial<Checkout> = {}): Checkout => ({
  id: 'checkout-1',
  status: 'paying',
  cartId: 'cart-1',
  customerId: 'customer-1',
  orderId: null,
  failureReason: null,
  paymentFailure: null,
  lines: [
    {
      sku: 'MUG-WHT',
      productName: 'Stoneware Mug',
      variantName: 'White',
      quantity: 1,
      unitAmount: 1800,
      lineAmount: 1800,
    },
  ],
  currency: 'USD',
  subtotal: 1800,
  discount: 180,
  total: 1620,
  couponCode: 'WELCOME10',
  createdAt: '2026-10-27T00:00:00Z',
  updatedAt: '2026-10-27T00:00:00Z',
  ...overrides,
})

const order: Order = {
  id: 'order-1',
  number: 'SW-000042',
  status: 'placed',
  customerId: 'customer-1',
  email: 'ada@shopwise.test',
  itemCount: 1,
  currency: 'USD',
  total: 1620,
  placedAt: '2026-10-27T10:00:00Z',
  checkoutId: 'checkout-1',
  paymentId: 'payment-1',
  lines: checkout().lines,
  subtotal: 1800,
  discount: 180,
  couponCode: 'WELCOME10',
  shippingAddress: {
    name: 'Ada Lovelace',
    line1: '1 Analytical Way',
    line2: null,
    city: 'London',
    region: null,
    postalCode: 'N1 1AA',
    country: 'GB',
  },
  shipment: null,
}

// The pages use the customer middleware, which sends guests to /login.
function signIn() {
  useState('nuxt-session').value = {
    user: { id: 'customer-1', email: 'ada@shopwise.test', name: 'Ada', roles: ['customer'] },
  }
}

describe('checkout page', () => {
  beforeEach(() => {
    clearNuxtData()
    signIn()
  })

  it('shows the summary, the address form and the test cards when no Stripe key is set', async () => {
    registerEndpoint('/api/cart', () => ({ data: cart }))

    const page = await mountSuspended(CheckoutPage, { route: '/checkout' })

    expect(page.text()).toContain('Shipping address')
    expect(page.text()).toContain('Discount (WELCOME10)')
    expect(page.text()).toContain('$16.20')
    expect(page.text()).toContain('Visa ending 4242')
    expect(page.text()).toContain('Visa ending 0002')
  })

  it('offers the 3-D Secure test card', async () => {
    registerEndpoint('/api/cart', () => ({ data: cart }))

    const page = await mountSuspended(CheckoutPage, { route: '/checkout' })

    expect(page.text()).toContain('Visa ending 3220')
  })

  it('points to the running checkout when the cart is locked', async () => {
    registerEndpoint('/api/cart', () => ({ data: { ...cart, lockedByCheckoutId: 'checkout-9' } }))

    const page = await mountSuspended(CheckoutPage, { route: '/checkout' })

    expect(page.find('[data-test="cart-locked"]').exists()).toBe(true)
    expect(page.find('a[href="/checkout/checkout-9"]').exists()).toBe(true)
    expect(page.find('button[type="submit"]').attributes('disabled')).toBeDefined()
  })

  it('blocks checkout while a line is unavailable', async () => {
    registerEndpoint('/api/cart', () => ({
      data: { ...cart, lines: [{ ...cart.lines[0]!, available: false }] },
    }))

    const page = await mountSuspended(CheckoutPage, { route: '/checkout' })

    expect(page.text()).toContain('Fix your cart before checking out.')
    expect(page.find('button[type="submit"]').attributes('disabled')).toBeDefined()
  })
})

describe('checkout status page', () => {
  beforeEach(() => {
    clearNuxtData()
    signIn()
  })

  it('shows the step while the saga runs', async () => {
    registerEndpoint('/api/checkout/checkout-1', () => ({ data: checkout() }))

    const page = await mountSuspended(CheckoutStatusPage, { route: '/checkout/checkout-1' })

    expect(page.text()).toContain('Taking payment…')
  })

  it('confirms the order once it is placed and links to it', async () => {
    registerEndpoint('/api/checkout/checkout-2', () => ({
      data: checkout({ id: 'checkout-2', status: 'completed', orderId: 'order-1' }),
    }))

    const page = await mountSuspended(CheckoutStatusPage, { route: '/checkout/checkout-2' })
    await flushPromises()

    expect(page.find('[data-test="checkout-confirmed"]').exists()).toBe(true)
    expect(page.find('a[href="/orders/order-1"]').exists()).toBe(true)
  })

  it('asks for 3-D Secure and, in test-card mode, explains how to finish it', async () => {
    registerEndpoint('/api/checkout/checkout-4', () => ({
      data: checkout({
        id: 'checkout-4',
        status: 'awaiting_payment_action',
        clientSecret: 'pi_fake_secret_abc',
        paymentActionExpiresAt: '2026-10-27T10:10:00Z',
      }),
    }))

    const page = await mountSuspended(CheckoutStatusPage, { route: '/checkout/checkout-4' })

    expect(page.find('[data-test="checkout-payment-action"]').text()).toContain('Confirm the payment with your bank')
    expect(page.find('[data-test="test-payment-action"]').exists()).toBe(true)
  })

  it("explains a declined card with payments' message", async () => {
    registerEndpoint('/api/checkout/checkout-3', () => ({
      data: checkout({
        id: 'checkout-3',
        status: 'failed',
        failureReason: 'payment_failed',
        paymentFailure: { reason: 'card_declined', message: 'Your card was declined.' },
      }),
    }))

    const page = await mountSuspended(CheckoutStatusPage, { route: '/checkout/checkout-3' })

    expect(page.find('[data-test="failure-reason"]').text()).toBe('Your card was declined. You have not been charged.')
  })
})

describe('order pages', () => {
  beforeEach(() => {
    clearNuxtData()
    signIn()
  })

  it('lists orders with number, item count and total', async () => {
    registerEndpoint('/api/orders', () => ({
      data: [order],
      meta: { page: 1, perPage: 20, total: 1, lastPage: 1 },
    }))

    const page = await mountSuspended(OrdersPage, { route: '/orders' })

    expect(page.text()).toContain('SW-000042')
    expect(page.text()).toContain('1 item')
    expect(page.text()).toContain('$16.20')
  })

  it('shows an order with its lines, discount and shipping address', async () => {
    registerEndpoint('/api/orders/order-1', () => ({ data: order }))

    const page = await mountSuspended(OrderPage, { route: '/orders/order-1' })

    expect(page.text()).toContain('Order SW-000042')
    expect(page.text()).toContain('Stoneware Mug')
    expect(page.text()).toContain('−$1.80')
    expect(page.text()).toContain('1 Analytical Way')
  })
})
