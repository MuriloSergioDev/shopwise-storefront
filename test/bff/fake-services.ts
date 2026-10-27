// In-memory fakes of identity, catalog, pricing, cart, checkout and orders, shaped by their OpenAPI contracts. Tests tweak `state`
// to provoke failures; `reset()` runs before each test.
import type { UpstreamCall, UpstreamReply } from './upstream'

export const PASSWORD = 'correct-horse-battery'

export const customer = {
  id: '01customer',
  email: 'ada@shopwise.test',
  name: 'Ada',
  roles: ['customer'],
  registeredAt: '2026-10-26T00:00:00Z',
}

export const searchResult = {
  data: [],
  meta: { page: 1, perPage: 24, total: 0, lastPage: 1 },
  facets: { categories: [], options: [] },
}

const PRICES: Record<string, number> = { 'TEE-BLK-M': 4500, 'TEE-BLK-L': 4500, 'MUG-WHT': 1800 }
const VARIANT_NAMES: Record<string, string> = {
  'TEE-BLK-M': 'Black / M',
  'TEE-BLK-L': 'Black / L',
  'MUG-WHT': 'White',
  'TEE-OLD': 'Retired',
}

interface FakeCart {
  id: string
  owner: 'guest' | 'customer'
  couponCode: string | null
  lines: Array<{ sku: string; quantity: number }>
}

export const state = {
  /** Lifetime of issued access tokens, in seconds. 0 makes the BFF refresh on its next request. */
  accessTtl: 900,
  /** Access tokens the services answer 401 to (e.g. signed with a rotated key). */
  rejectedAccess: new Set<string>(),
  /** Holds the refresh response back, so concurrent requests overlap. */
  refreshDelayMs: 0,
  refreshFails: false,
  mergeFails: false,
  pricingDown: false,
  /** Refresh tokens that came back after being spent: identity would revoke the family. */
  reusedRefreshTokens: [] as string[],
  carts: new Map<string, FakeCart>(),
  /** Checkouts by id; tests move their status along. */
  checkouts: new Map<string, FakeCheckout>(),
  /** Checkout answers 409: the cart has another checkout in progress. */
  checkoutInProgress: false,
}

type FakeCheckout = Record<string, unknown> & { id: string; idempotencyKey: string }

const shippingAddress = {
  name: 'Ada',
  line1: '1 Analytical Way',
  line2: null,
  city: 'London',
  region: null,
  postalCode: 'N1 1AA',
  country: 'GB',
}

export const orderSummary = {
  id: '01order',
  number: 'SW-000001',
  status: 'placed',
  customerId: customer.id,
  email: customer.email,
  itemCount: 1,
  currency: 'USD',
  total: 1800,
  placedAt: '2026-10-27T00:00:00Z',
}

export const order = {
  ...orderSummary,
  checkoutId: 'checkout-1',
  paymentId: '01payment',
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
  subtotal: 1800,
  discount: 0,
  couponCode: null,
  shippingAddress,
  shipment: null,
}

// Token numbers keep counting across tests: the BFF's refresh coordinator outlives a test.
let issued = 0
const spent = new Set<string>()
const live = new Set<string>()
let guestCarts = 0

export function reset() {
  state.accessTtl = 900
  state.rejectedAccess.clear()
  state.refreshDelayMs = 0
  state.refreshFails = false
  state.mergeFails = false
  state.pricingDown = false
  state.reusedRefreshTokens = []
  state.carts.clear()
  state.checkouts.clear()
  state.checkoutInProgress = false
  guestCarts = 0
}

/** The number in the last issued `access-N` / `refresh-N` pair. */
export const lastIssued = () => issued

export function issuePair() {
  issued += 1
  live.add(`refresh-${issued}`)

  return {
    tokenType: 'Bearer',
    accessToken: `access-${issued}`,
    expiresIn: state.accessTtl,
    refreshToken: `refresh-${issued}`,
    refreshExpiresIn: 2_592_000,
  }
}

const ok = (body: unknown, status = 200): UpstreamReply => ({ status, body })
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function bearer(call: UpstreamCall): string | null {
  const token = call.headers.authorization?.replace(/^Bearer /, '')

  return token?.startsWith('access-') && !state.rejectedAccess.has(token) ? token : null
}

function toCart(cart: FakeCart) {
  return {
    data: {
      id: cart.id,
      owner: cart.owner,
      couponCode: cart.couponCode,
      updatedAt: '2026-10-26T00:00:00Z',
      lines: cart.lines.map(({ sku, quantity }) => ({
        sku,
        quantity,
        productSlug: sku.startsWith('MUG') ? 'stoneware-mug' : 'merino-crew-tee',
        productName: sku.startsWith('MUG') ? 'Stoneware Mug' : 'Merino Crew Tee',
        variantName: VARIANT_NAMES[sku] ?? sku,
        available: sku !== 'TEE-OLD',
        unitAmount: PRICES[sku] ?? 3000,
        currency: 'USD',
      })),
    },
  }
}

function customerCart(): FakeCart {
  let cart = state.carts.get('customer-cart')
  if (!cart) {
    cart = { id: 'customer-cart', owner: 'customer', couponCode: null, lines: [] }
    state.carts.set(cart.id, cart)
  }

  return cart
}

/** A cart the caller may touch: guest carts by id alone, the customer cart only with a valid token. */
function ownedCart(call: UpstreamCall, id: string): FakeCart | undefined {
  const cart = state.carts.get(id)

  return cart && (cart.owner === 'guest' || bearer(call)) ? cart : undefined
}

async function identity(call: UpstreamCall): Promise<UpstreamReply | undefined> {
  switch (`${call.method} ${call.path}`) {
    case 'POST /api/tokens':
      return call.body?.password === PASSWORD
        ? ok({ data: issuePair() })
        : { status: 422, body: { message: 'These credentials do not match our records.' } }
    case 'POST /api/customers':
      return ok({ data: issuePair() }, 201)
    case 'POST /api/tokens/refresh': {
      const token = String(call.body?.refreshToken)
      await sleep(state.refreshDelayMs)
      if (spent.has(token)) {
        state.reusedRefreshTokens.push(token)

        return { status: 401 }
      }
      if (state.refreshFails || !live.has(token)) {
        return { status: 401 }
      }
      spent.add(token)
      live.delete(token)

      return ok({ data: issuePair() })
    }
    case 'GET /api/me':
      return bearer(call) ? ok({ data: customer }) : { status: 401 }
    case 'POST /api/tokens/revoke':
      return { status: 204 }
  }
}

function catalog(call: UpstreamCall): UpstreamReply | undefined {
  switch (`${call.method} ${call.path}`) {
    case 'GET /api/products':
      return ok(searchResult)
    case 'GET /api/products/missing':
      return { status: 404, body: { message: 'Not found.' } }
  }
}

function pricing(call: UpstreamCall): UpstreamReply | undefined {
  if (call.method === 'GET' && call.path === '/api/prices') {
    const skus = call.query.getAll('skus[]')

    return ok({
      data: skus.filter((sku) => PRICES[sku]).map((sku) => ({ sku, amount: PRICES[sku], currency: 'USD' })),
    })
  }
  if (call.method === 'POST' && call.path === '/api/quotes') {
    if (state.pricingDown) {
      return { status: 503 }
    }
    const requested = call.body?.lines as Array<{ sku: string; quantity: number }>
    const lines = requested.map(({ sku, quantity }) => {
      const unitAmount = PRICES[sku] ?? null

      return { sku, quantity, unitAmount, lineAmount: unitAmount === null ? null : unitAmount * quantity }
    })
    const subtotal = lines.reduce((sum, line) => sum + (line.lineAmount ?? 0), 0)
    const code = call.body?.couponCode as string | undefined
    let coupon = null
    let discount = 0
    if (code === 'TENOFF') {
      coupon = { code, valid: true, reason: null, description: '10% off everything' }
      discount = Math.round(subtotal / 10)
    } else if (code === 'BIGSPEND') {
      coupon = { code, valid: false, reason: 'min_subtotal_not_met', description: '$20 off orders over $200' }
    } else if (code) {
      coupon = { code, valid: false, reason: 'unknown', description: null }
    }

    return ok({ data: { currency: 'USD', lines, subtotal, discount, total: subtotal - discount, coupon } })
  }
}

function cart(call: UpstreamCall): UpstreamReply | undefined {
  const route = `${call.method} ${call.path}`
  if (route === 'POST /api/carts') {
    guestCarts += 1
    const created: FakeCart = { id: `guest-${guestCarts}`, owner: 'guest', couponCode: null, lines: [] }
    state.carts.set(created.id, created)

    return ok(toCart(created), 201)
  }
  if (route === 'GET /api/me/cart') {
    return bearer(call) ? ok(toCart(customerCart())) : { status: 401 }
  }
  if (route === 'POST /api/me/cart/merge') {
    if (!bearer(call)) {
      return { status: 401 }
    }
    if (state.mergeFails) {
      return { status: 503 }
    }
    const target = customerCart()
    const guest = state.carts.get(String(call.body?.guestCartId))
    if (guest?.owner === 'guest') {
      for (const line of guest.lines) {
        const existing = target.lines.find((candidate) => candidate.sku === line.sku)
        if (existing) {
          existing.quantity = Math.min(existing.quantity + line.quantity, 99)
        } else {
          target.lines.push({ ...line })
        }
      }
      target.couponCode ??= guest.couponCode
      state.carts.delete(guest.id)
    }

    return ok(toCart(target))
  }

  const match = /^\/api\/carts\/([^/]+)(?:\/(items|coupon)(?:\/([^/]+))?)?$/.exec(call.path)
  if (!match) {
    return undefined
  }
  const [, id, resource, sku] = match
  const target = ownedCart(call, decodeURIComponent(id!))
  if (!target) {
    return { status: 404, body: { message: 'Cart not found.' } }
  }

  if (call.method === 'GET' && !resource) {
    return ok(toCart(target))
  }
  if (resource === 'items' && sku) {
    const decoded = decodeURIComponent(sku)
    if (call.method === 'PUT') {
      if (!VARIANT_NAMES[decoded]) {
        return { status: 422, body: { message: 'The sku is invalid.', errors: { sku: ['The sku is invalid.'] } } }
      }
      const quantity = Number(call.body?.quantity)
      const existing = target.lines.find((line) => line.sku === decoded)
      if (existing) {
        existing.quantity = quantity
      } else {
        target.lines.push({ sku: decoded, quantity })
      }
    } else if (call.method === 'DELETE') {
      target.lines = target.lines.filter((line) => line.sku !== decoded)
    }

    return ok(toCart(target))
  }
  if (resource === 'coupon') {
    target.couponCode = call.method === 'PUT' ? String(call.body?.code).toUpperCase() : null

    return ok(toCart(target))
  }
}

function checkout(call: UpstreamCall): UpstreamReply | undefined {
  if (call.method === 'POST' && call.path === '/api/checkouts') {
    if (!bearer(call)) {
      return { status: 401 }
    }
    const key = String(call.headers['idempotency-key'] ?? '')
    const existing = [...state.checkouts.values()].find((candidate) => candidate.idempotencyKey === key)
    if (existing) {
      return ok({ data: existing })
    }
    if (state.checkoutInProgress) {
      return { status: 409, body: { message: 'The cart already has a checkout in progress.' } }
    }
    const target = state.carts.get(String(call.body?.cartId))
    if (!target || target.owner !== 'customer') {
      return { status: 404, body: { message: 'Cart not found.' } }
    }
    if (target.couponCode === 'BIGSPEND') {
      return {
        status: 422,
        body: { message: 'min_subtotal_not_met', errors: { couponCode: ['min_subtotal_not_met'] } },
      }
    }
    const lines = target.lines.map(({ sku, quantity }) => ({
      sku,
      productName: 'Stoneware Mug',
      variantName: VARIANT_NAMES[sku] ?? sku,
      quantity,
      unitAmount: PRICES[sku] ?? 0,
      lineAmount: (PRICES[sku] ?? 0) * quantity,
    }))
    const total = lines.reduce((sum, line) => sum + line.lineAmount, 0)
    const created: FakeCheckout = {
      id: `checkout-${state.checkouts.size + 1}`,
      idempotencyKey: key,
      status: 'reserving',
      cartId: target.id,
      customerId: customer.id,
      orderId: null,
      failureReason: null,
      paymentFailure: null,
      lines,
      currency: 'USD',
      subtotal: total,
      discount: 0,
      total,
      couponCode: target.couponCode,
      createdAt: '2026-10-27T00:00:00Z',
      updatedAt: '2026-10-27T00:00:00Z',
    }
    state.checkouts.set(created.id, created)

    return ok({ data: created }, 202)
  }
  const match = /^\/api\/checkouts\/([^/]+)$/.exec(call.path)
  if (call.method === 'GET' && match) {
    if (!bearer(call)) {
      return { status: 401 }
    }
    const found = state.checkouts.get(decodeURIComponent(match[1]!))

    return found ? ok({ data: found }) : { status: 404, body: { message: 'Checkout not found.' } }
  }
}

function orders(call: UpstreamCall): UpstreamReply | undefined {
  if (call.method !== 'GET' || !call.path.startsWith('/api/me/orders')) {
    return undefined
  }
  if (!bearer(call)) {
    return { status: 401 }
  }
  if (call.path === '/api/me/orders') {
    const page = Number(call.query.get('page') ?? 1)

    return ok({ data: [orderSummary], meta: { page, perPage: 20, total: 1, lastPage: 1 } })
  }

  return call.path === `/api/me/orders/${order.id}`
    ? ok({ data: order })
    : { status: 404, body: { message: 'Order not found.' } }
}

export async function reply(call: UpstreamCall): Promise<UpstreamReply> {
  return (
    (await identity(call)) ??
    catalog(call) ??
    pricing(call) ??
    cart(call) ??
    checkout(call) ??
    orders(call) ?? {
      status: 500,
      body: { message: 'SQLSTATE[42P01]: relation "products" does not exist' },
    }
  )
}
