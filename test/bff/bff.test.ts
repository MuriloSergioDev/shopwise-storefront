// Builds the app and runs the real Nitro server against fake identity, catalog, pricing, cart, checkout and orders.
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import { startUpstream, type UpstreamCall } from './upstream'
import { PASSWORD, customer, lastIssued, order, reply, reset, searchResult, state } from './fake-services'

const upstream = await startUpstream(reply)
for (const service of ['IDENTITY', 'CATALOG', 'PRICING', 'CART', 'CHECKOUT', 'ORDERS']) {
  process.env[`NUXT_${service}_URL`] = upstream.url
}
process.env.NUXT_SESSION_PASSWORD = 'test-session-password-at-least-32-chars'

await setup({ server: true, browser: false })

afterAll(() => upstream.close())
beforeEach(() => {
  upstream.calls.length = 0
  reset()
})

/** Keeps the cookies a browser would: each response's Set-Cookie replaces (or deletes) the stored one. */
class Browser {
  private cookies = new Map<string, string>()

  get cookie(): string {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ')
  }

  async request(path: string, init: { method?: string; body?: unknown; cookie?: string } = {}): Promise<Response> {
    const cookie = init.cookie ?? this.cookie
    const response = await fetch(path, {
      method: init.method ?? 'GET',
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    })
    this.store(response)

    return response
  }

  store(response: Response) {
    for (const header of response.headers.getSetCookie()) {
      const [pair] = header.split(';')
      const [name, ...value] = pair!.split('=')
      if (value.join('=') === '') {
        this.cookies.delete(name!)
      } else {
        this.cookies.set(name!, value.join('='))
      }
    }
  }

  post = (path: string, body?: unknown) => this.request(path, { method: 'POST', body })

  async session() {
    return (await this.request('/api/_auth/session')).json()
  }

  async signIn() {
    const response = await this.post('/api/auth/login', { email: customer.email, password: PASSWORD })
    expect(response.status).toBe(200)

    return response
  }
}

const callsTo = (method: string, path: string): UpstreamCall[] =>
  upstream.calls.filter((call) => call.method === method && call.path === path)

describe('auth', () => {
  it('signs in: exchanges credentials, loads the customer and keeps tokens out of the browser', async () => {
    const browser = new Browser()
    const response = await browser.signIn()

    expect(await response.json()).toEqual({ data: customer })
    expect(callsTo('GET', '/api/me')[0]?.headers.authorization).toMatch(/^Bearer access-\d+$/)

    const current = await browser.session()
    expect(current.user).toEqual({ id: customer.id, email: customer.email, name: 'Ada', roles: ['customer'] })
    expect(JSON.stringify(current)).not.toMatch(/access-|refresh-/)
  })

  it("passes identity's message through when credentials are wrong", async () => {
    const response = await new Browser().post('/api/auth/login', { email: customer.email, password: 'wrong-password' })

    expect(response.status).toBe(422)
    expect((await response.json()).statusMessage).toBe('These credentials do not match our records.')
  })

  it('rejects a malformed body without calling identity', async () => {
    const response = await new Browser().post('/api/auth/login', { email: 'not-an-email' })

    expect(response.status).toBe(400)
    expect(upstream.calls).toHaveLength(0)
  })

  it('registers and signs the new customer in', async () => {
    const browser = new Browser()
    const response = await browser.post('/api/auth/register', {
      name: 'Ada',
      email: customer.email,
      password: PASSWORD,
    })

    expect(response.status).toBe(201)
    expect(callsTo('POST', '/api/customers')[0]?.body).toEqual({
      name: 'Ada',
      email: customer.email,
      password: PASSWORD,
    })
    expect((await browser.session()).user?.email).toBe(customer.email)
  })

  it('signs out: revokes the refresh token and clears the session', async () => {
    const browser = new Browser()
    await browser.signIn()
    const refreshToken = `refresh-${lastIssued()}`

    const response = await browser.post('/api/auth/logout')

    expect(response.status).toBe(204)
    expect(callsTo('POST', '/api/tokens/revoke')[0]?.body).toEqual({ refreshToken })
    expect((await browser.session()).user).toBeUndefined()
  })
})

describe('catalog', () => {
  it('forwards search filters and drops unknown ones', async () => {
    const response = await fetch('/api/catalog/products?q=tee&options[color]=Black&page=2&sort=price', {
      headers: { traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01' },
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(searchResult)
    const call = upstream.calls[0]!
    expect(Object.fromEntries(call.query)).toEqual({ q: 'tee', 'options[color]': 'Black', page: '2' })
    // Same trace, under a span of the BFF's own.
    expect(call.headers.traceparent).toMatch(/^00-0af7651916cd43dd8448eb211c80319c-[0-9a-f]{16}-01$/)
    expect(call.headers.traceparent).not.toContain('b7ad6b7169203331')
  })

  it('starts a trace when the request carries none', async () => {
    await fetch('/api/catalog/products?q=tee')

    expect(upstream.calls[0]?.headers.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/)
  })

  it('rejects invalid paging without calling catalog', async () => {
    const response = await fetch('/api/catalog/products?perPage=500')

    expect(response.status).toBe(400)
    expect(upstream.calls).toHaveLength(0)
  })

  it('passes a missing product through as 404', async () => {
    expect((await fetch('/api/catalog/products/missing')).status).toBe(404)
  })

  it('turns a catalog failure into a 502 without leaking its message', async () => {
    const response = await fetch('/api/catalog/products/broken')
    const body = await response.text()

    expect(response.status).toBe(502)
    expect(body).toContain('The catalog service is unavailable.')
    expect(body).not.toContain('SQLSTATE')
  })
})

describe('pricing', () => {
  it('forwards the SKUs as skus[] and returns the prices that exist', async () => {
    const response = await fetch('/api/pricing/prices?skus[]=TEE-BLK-M&skus[]=NOPE')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: [{ sku: 'TEE-BLK-M', amount: 4500, currency: 'USD' }] })
    expect(callsTo('GET', '/api/prices')[0]?.query.getAll('skus[]')).toEqual(['TEE-BLK-M', 'NOPE'])
  })

  it('rejects a request without SKUs', async () => {
    expect((await fetch('/api/pricing/prices')).status).toBe(400)
    expect(upstream.calls).toHaveLength(0)
  })
})

describe('guest cart', () => {
  it('is empty without calling the cart service until something is added', async () => {
    const response = await new Browser().request('/api/cart')

    expect(response.status).toBe(200)
    expect((await response.json()).data).toMatchObject({ owner: 'guest', lines: [], itemCount: 0 })
    expect(upstream.calls).toHaveLength(0)
  })

  it('creates the cart on the first add, keeps its id in the sealed session and reuses it', async () => {
    const browser = new Browser()

    const first = await browser.post('/api/cart/items', { sku: 'TEE-BLK-M' })

    expect(first.status).toBe(200)
    expect(callsTo('POST', '/api/carts')).toHaveLength(1)
    expect(callsTo('PUT', '/api/carts/guest-1/items/TEE-BLK-M')[0]?.body).toEqual({ quantity: 1 })
    const body = await first.json()
    expect(body.data).toMatchObject({ owner: 'guest', itemCount: 1, totals: { subtotal: 4500, total: 4500 } })
    expect(JSON.stringify(body)).not.toContain('guest-1')
    expect(JSON.stringify(await browser.session())).not.toContain('guest-1')

    upstream.calls.length = 0
    const second = await browser.post('/api/cart/items', { sku: 'TEE-BLK-M', quantity: 2 })

    expect(callsTo('POST', '/api/carts')).toHaveLength(0)
    expect(callsTo('PUT', '/api/carts/guest-1/items/TEE-BLK-M')[0]?.body).toEqual({ quantity: 3 })
    expect((await second.json()).data.itemCount).toBe(3)
  })

  it('starts a new cart when the stored one is gone', async () => {
    const browser = new Browser()
    await browser.post('/api/cart/items', { sku: 'MUG-WHT' })
    state.carts.clear()

    const response = await browser.post('/api/cart/items', { sku: 'MUG-WHT' })

    expect(response.status).toBe(200)
    expect((await response.json()).data.itemCount).toBe(1)
    expect(callsTo('POST', '/api/carts')).toHaveLength(2)
  })

  it('sets a quantity and removes an item', async () => {
    const browser = new Browser()
    await browser.post('/api/cart/items', { sku: 'TEE-BLK-M' })
    await browser.post('/api/cart/items', { sku: 'MUG-WHT' })

    const set = await browser.request('/api/cart/items/MUG-WHT', { method: 'PUT', body: { quantity: 4 } })
    expect((await set.json()).data.totals.subtotal).toBe(4500 + 4 * 1800)

    const removed = await browser.request('/api/cart/items/TEE-BLK-M', { method: 'DELETE' })
    expect((await removed.json()).data.lines.map((line: { sku: string }) => line.sku)).toEqual(['MUG-WHT'])
  })

  it('rejects an invalid quantity without calling the cart service', async () => {
    const response = await new Browser().request('/api/cart/items/MUG-WHT', { method: 'PUT', body: { quantity: 0 } })

    expect(response.status).toBe(400)
    expect(upstream.calls).toHaveLength(0)
  })

  it("words the cart service's 422 for the shopper", async () => {
    const response = await new Browser().post('/api/cart/items', { sku: 'NOT-A-SKU' })

    expect(response.status).toBe(422)
    expect((await response.json()).statusMessage).toBe('This item is not for sale any more.')
  })
})

describe('cart pricing', () => {
  it('composes the cart lines with the quote and leaves unavailable lines out of the quote', async () => {
    const browser = new Browser()
    await browser.post('/api/cart/items', { sku: 'TEE-BLK-M', quantity: 2 })
    await browser.post('/api/cart/items', { sku: 'TEE-OLD' })
    upstream.calls.length = 0

    const { data: cart } = await (await browser.request('/api/cart')).json()

    expect(callsTo('POST', '/api/quotes')[0]?.body).toEqual({ lines: [{ sku: 'TEE-BLK-M', quantity: 2 }] })
    expect(cart).toMatchObject({
      currency: 'USD',
      itemCount: 3,
      totals: { subtotal: 9000, discount: 0, total: 9000 },
      lines: [
        { sku: 'TEE-BLK-M', productName: 'Merino Crew Tee', unitAmount: 4500, lineAmount: 9000, available: true },
        { sku: 'TEE-OLD', available: false, lineAmount: null },
      ],
    })
  })

  it('applies a valid coupon and removes it', async () => {
    const browser = new Browser()
    await browser.post('/api/cart/items', { sku: 'TEE-BLK-M', quantity: 2 })

    const applied = await browser.request('/api/cart/coupon', { method: 'PUT', body: { code: 'tenoff' } })
    const { data: cart } = await applied.json()

    expect(callsTo('POST', '/api/quotes').at(-1)?.body).toMatchObject({ couponCode: 'TENOFF' })
    expect(cart).toMatchObject({
      couponCode: 'TENOFF',
      coupon: { valid: true, message: null, description: '10% off everything' },
      totals: { subtotal: 9000, discount: 900, total: 8100 },
    })

    const removed = await browser.request('/api/cart/coupon', { method: 'DELETE' })
    expect((await removed.json()).data).toMatchObject({ couponCode: null, coupon: null })
  })

  it('explains why a coupon does not apply', async () => {
    const browser = new Browser()
    await browser.post('/api/cart/items', { sku: 'MUG-WHT' })

    const response = await browser.request('/api/cart/coupon', { method: 'PUT', body: { code: 'BIGSPEND' } })
    const { data: cart } = await response.json()

    expect(response.status).toBe(200)
    expect(cart.coupon).toMatchObject({ code: 'BIGSPEND', valid: false, reason: 'min_subtotal_not_met' })
    expect(cart.coupon.message).toBe('Your order does not reach the minimum for this coupon yet.')
    expect(cart.totals.discount).toBe(0)
  })

  it('rejects a malformed coupon code with a readable message', async () => {
    const response = await new Browser().request('/api/cart/coupon', { method: 'PUT', body: { code: 'no spaces!' } })

    expect(response.status).toBe(400)
    expect(upstream.calls).toHaveLength(0)
  })

  it('still shows the cart, without totals, when pricing is down', async () => {
    const browser = new Browser()
    await browser.post('/api/cart/items', { sku: 'MUG-WHT' })
    state.pricingDown = true

    const response = await browser.request('/api/cart')
    const { data: cart } = await response.json()

    expect(response.status).toBe(200)
    expect(cart.totals).toBeNull()
    expect(cart.lines[0]).toMatchObject({ sku: 'MUG-WHT', unitAmount: 1800 })
  })
})

describe('customer cart', () => {
  it("uses the customer's cart with their bearer token", async () => {
    const browser = new Browser()
    await browser.signIn()
    const token = `Bearer access-${lastIssued()}`
    upstream.calls.length = 0

    const response = await browser.post('/api/cart/items', { sku: 'MUG-WHT' })

    expect(response.status).toBe(200)
    expect((await response.json()).data).toMatchObject({ owner: 'customer', itemCount: 1 })
    expect(callsTo('GET', '/api/me/cart')[0]?.headers.authorization).toBe(token)
    expect(callsTo('PUT', '/api/carts/customer-cart/items/MUG-WHT')[0]?.headers.authorization).toBe(token)
    expect(callsTo('POST', '/api/carts')).toHaveLength(0)
  })

  for (const [name, signIn] of [
    ['login', (browser: Browser) => browser.signIn()],
    [
      'register',
      (browser: Browser) =>
        browser.post('/api/auth/register', { name: 'Ada', email: customer.email, password: PASSWORD }),
    ],
  ] as const) {
    it(`merges the guest cart on ${name} and forgets its id`, async () => {
      const browser = new Browser()
      await browser.post('/api/cart/items', { sku: 'TEE-BLK-L', quantity: 2 })

      await signIn(browser)

      const merge = callsTo('POST', '/api/me/cart/merge')
      expect(merge).toHaveLength(1)
      expect(merge[0]?.body).toEqual({ guestCartId: 'guest-1' })
      expect(merge[0]?.headers.authorization).toMatch(/^Bearer access-\d+$/)

      upstream.calls.length = 0
      const { data: cart } = await (await browser.request('/api/cart')).json()
      expect(callsTo('POST', '/api/me/cart/merge')).toHaveLength(0)
      expect(cart).toMatchObject({ owner: 'customer', itemCount: 2, lines: [{ sku: 'TEE-BLK-L' }] })
    })
  }

  it('signs in even when the merge fails, and retries the merge on the next cart request', async () => {
    const browser = new Browser()
    await browser.post('/api/cart/items', { sku: 'TEE-BLK-L' })
    state.mergeFails = true

    await browser.signIn()
    expect((await browser.session()).user?.email).toBe(customer.email)

    state.mergeFails = false
    upstream.calls.length = 0
    const { data: cart } = await (await browser.request('/api/cart')).json()

    expect(callsTo('POST', '/api/me/cart/merge')[0]?.body).toEqual({ guestCartId: 'guest-1' })
    expect(cart).toMatchObject({ owner: 'customer', itemCount: 1 })
  })
})

describe('token refresh', () => {
  it('refreshes once and retries when a service answers 401', async () => {
    const browser = new Browser()
    await browser.signIn()
    const n = lastIssued()
    state.rejectedAccess.add(`access-${n}`)
    upstream.calls.length = 0

    const response = await browser.request('/api/cart')

    expect(response.status).toBe(200)
    expect((await response.json()).data.owner).toBe('customer')
    expect(callsTo('POST', '/api/tokens/refresh').map((call) => call.body)).toEqual([{ refreshToken: `refresh-${n}` }])
    expect(callsTo('GET', '/api/me/cart').map((call) => call.headers.authorization)).toEqual([
      `Bearer access-${n}`,
      `Bearer access-${n + 1}`,
    ])

    // The new pair was stored: the next request uses it without refreshing again.
    upstream.calls.length = 0
    await browser.request('/api/cart')
    expect(callsTo('POST', '/api/tokens/refresh')).toHaveLength(0)
    expect(callsTo('GET', '/api/me/cart')[0]?.headers.authorization).toBe(`Bearer access-${n + 1}`)
  })

  it('shares one refresh between concurrent requests and late requests with the old cookie', async () => {
    state.accessTtl = 0
    const browser = new Browser()
    await browser.signIn()
    const oldCookie = browser.cookie
    state.accessTtl = 900
    state.refreshDelayMs = 300
    upstream.calls.length = 0

    const responses = await Promise.all([1, 2, 3].map(() => browser.request('/api/cart', { cookie: oldCookie })))
    const late = await browser.request('/api/cart', { cookie: oldCookie })

    for (const response of [...responses, late]) {
      expect(response.status).toBe(200)
      expect((await response.json()).data.owner).toBe('customer')
    }
    expect(callsTo('POST', '/api/tokens/refresh')).toHaveLength(1)
    expect(state.reusedRefreshTokens).toEqual([])
    expect((await browser.session()).user?.email).toBe(customer.email)
  })

  it('refreshes on page requests, so SSR renders do not spend the token without storing the new one', async () => {
    state.accessTtl = 0
    const browser = new Browser()
    await browser.signIn()
    state.accessTtl = 900
    const before = browser.cookie
    upstream.calls.length = 0

    const page = await browser.request('/cart')

    expect(page.status).toBe(200)
    expect(callsTo('POST', '/api/tokens/refresh')).toHaveLength(1)
    expect(browser.cookie).not.toBe(before)
    expect(state.reusedRefreshTokens).toEqual([])
  })

  it('treats the shopper as a guest when the refresh token is rejected', async () => {
    state.accessTtl = 0
    const browser = new Browser()
    await browser.signIn()
    state.refreshFails = true

    const response = await browser.request('/api/cart')

    expect(response.status).toBe(200)
    expect((await response.json()).data).toMatchObject({ owner: 'guest', lines: [] })
    expect(callsTo('GET', '/api/me/cart')).toHaveLength(0)
    expect((await browser.session()).user).toBeUndefined()
  })
})

const address = {
  name: 'Ada Lovelace',
  line1: '1 Analytical Way',
  line2: '',
  city: 'London',
  postalCode: 'N1 1AA',
  country: 'GB',
}
const attempt = (attemptId: string = crypto.randomUUID()) => ({
  attemptId,
  paymentMethodId: 'pm_card_visa',
  shippingAddress: address,
})

describe('checkout', () => {
  async function customerWithMug() {
    const browser = new Browser()
    await browser.signIn()
    await browser.post('/api/cart/items', { sku: 'MUG-WHT' })
    upstream.calls.length = 0

    return browser
  }

  it("starts a checkout for the customer's cart with their token and the attempt as Idempotency-Key", async () => {
    const browser = await customerWithMug()
    const body = attempt()

    const response = await browser.post('/api/checkout', body)

    expect(response.status).toBe(202)
    expect((await response.json()).data).toMatchObject({ id: 'checkout-1', status: 'reserving', total: 1800 })
    const [start] = callsTo('POST', '/api/checkouts')
    expect(start?.headers.authorization).toBe(`Bearer access-${lastIssued()}`)
    expect(start?.headers['idempotency-key']).toBe(body.attemptId)
    expect(start?.body).toEqual({
      cartId: 'customer-cart',
      paymentMethodId: 'pm_card_visa',
      shippingAddress: { ...address, line2: null, region: null },
    })
  })

  it('returns the same checkout when the same attempt is submitted twice', async () => {
    const browser = await customerWithMug()
    const body = attempt()

    const first = await (await browser.post('/api/checkout', body)).json()
    const second = await (await browser.post('/api/checkout', body)).json()

    expect(second.data.id).toBe(first.data.id)
    expect(state.checkouts.size).toBe(1)
  })

  it('asks guests to sign in without calling checkout', async () => {
    const browser = new Browser()
    await browser.post('/api/cart/items', { sku: 'MUG-WHT' })
    upstream.calls.length = 0

    const response = await browser.post('/api/checkout', attempt())

    expect(response.status).toBe(401)
    expect(callsTo('POST', '/api/checkouts')).toHaveLength(0)
  })

  it('refuses an empty cart before calling checkout', async () => {
    const browser = new Browser()
    await browser.signIn()

    const response = await browser.post('/api/checkout', attempt())

    expect(response.status).toBe(422)
    expect((await response.json()).statusMessage).toBe('Your cart is empty.')
    expect(callsTo('POST', '/api/checkouts')).toHaveLength(0)
  })

  it("words checkout's coupon refusal and a checkout already in progress for the shopper", async () => {
    const browser = await customerWithMug()
    await browser.request('/api/cart/coupon', { method: 'PUT', body: { code: 'BIGSPEND' } })

    const coupon = await browser.post('/api/checkout', attempt())
    expect(coupon.status).toBe(422)
    expect((await coupon.json()).statusMessage).toBe('Your order does not reach the minimum for this coupon yet.')

    await browser.request('/api/cart/coupon', { method: 'DELETE' })
    state.checkoutInProgress = true
    const busy = await browser.post('/api/checkout', attempt())
    expect(busy.status).toBe(409)
    expect((await busy.json()).statusMessage).toBe('Your cart already has a checkout in progress.')
  })

  it('rejects a card number or a malformed address without calling a service', async () => {
    const browser = await customerWithMug()

    const card = await browser.post('/api/checkout', { ...attempt(), paymentMethodId: '4242424242424242' })
    const country = await browser.post('/api/checkout', {
      ...attempt(),
      shippingAddress: { ...address, country: 'Britain' },
    })

    expect(card.status).toBe(400)
    expect(country.status).toBe(400)
    expect(upstream.calls).toHaveLength(0)
  })

  it('reads the checkout status with the customer token, and 404s for an unknown one', async () => {
    const browser = await customerWithMug()
    const { data: started } = await (await browser.post('/api/checkout', attempt())).json()
    Object.assign(state.checkouts.get(started.id)!, {
      status: 'failed',
      failureReason: 'payment_failed',
      paymentFailure: { reason: 'card_declined', message: 'Your card was declined.' },
    })

    const response = await browser.request(`/api/checkout/${started.id}`)

    expect(response.status).toBe(200)
    expect((await response.json()).data).toMatchObject({ status: 'failed', failureReason: 'payment_failed' })
    expect(callsTo('GET', `/api/checkouts/${started.id}`)[0]?.headers.authorization).toMatch(/^Bearer access-/)
    expect((await browser.request('/api/checkout/unknown')).status).toBe(404)
  })
})

describe('orders', () => {
  it("lists the customer's orders and shows one", async () => {
    const browser = new Browser()
    await browser.signIn()

    const list = await (await browser.request('/api/orders?page=1')).json()
    const detail = await browser.request(`/api/orders/${order.id}`)

    expect(list.data).toEqual([expect.objectContaining({ id: order.id, number: 'SW-000001', total: 1800 })])
    expect(callsTo('GET', '/api/me/orders')[0]?.query.get('page')).toBe('1')
    expect(detail.status).toBe(200)
    expect((await detail.json()).data).toMatchObject({ number: 'SW-000001', shippingAddress: { city: 'London' } })
    expect((await browser.request('/api/orders/someone-elses')).status).toBe(404)
  })

  it('asks guests to sign in', async () => {
    const response = await new Browser().request('/api/orders')

    expect(response.status).toBe(401)
    expect(callsTo('GET', '/api/me/orders')).toHaveLength(0)
  })
})
