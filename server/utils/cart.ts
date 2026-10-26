import type { H3Event } from 'h3'
import type { Cart, Quote } from '#shared/types/contracts'
import type { CartView } from '#shared/types/cart'

interface CartResponse {
  data: Cart
}

const cartPath = (cart: Pick<Cart, 'id'>, rest = '') => `/api/carts/${encodeURIComponent(cart.id)}${rest}`

/**
 * The shopper's cart, or null for a guest who has none yet. A customer's is created by the cart service on first
 * access; before reading it, a guest cart left over from a failed sign-in merge is merged.
 */
export async function findCart(event: H3Event, token: string | undefined): Promise<Cart | null> {
  if (token) {
    const merged = await mergePendingGuestCart(event, token)
    if (merged) {
      return merged
    }

    return (await serviceFetch<CartResponse>(event, 'cart', '/api/me/cart', { token })).data
  }

  const guestCartId = (await sessionData(event)).secure?.guestCartId
  if (!guestCartId) {
    return null
  }
  try {
    return (await serviceFetch<CartResponse>(event, 'cart', cartPath({ id: guestCartId }))).data
  } catch (error) {
    if (statusOf(error) !== 404) {
      throw error
    }
    // Expired or merged elsewhere: start over.
    await forgetGuestCart(event)

    return null
  }
}

/** Like findCart, but creates a guest cart (and remembers its id in the sealed session) when there is none. */
async function openCart(event: H3Event, token: string | undefined): Promise<Cart> {
  const found = await findCart(event, token)
  if (found) {
    return found
  }

  const { data: cart } = await serviceFetch<CartResponse>(event, 'cart', '/api/carts', { method: 'POST' })
  await setUserSession(event, { secure: { guestCartId: cart.id } })

  return cart
}

/**
 * Applies a change to the shopper's cart and returns the result. `change` may run twice (after a token refresh,
 * or on a fresh guest cart when the stored one is gone), so it must be idempotent. 422s become shopper-facing
 * messages.
 */
export async function updateCart(
  event: H3Event,
  change: (cart: Cart, token: string | undefined) => Promise<CartResponse>,
): Promise<Cart> {
  try {
    return await asShopper(event, async (token) => {
      const cart = await openCart(event, token)
      try {
        return (await change(cart, token)).data
      } catch (error) {
        if (token || statusOf(error) !== 404) {
          throw error
        }
        await forgetGuestCart(event)

        return (await change(await openCart(event, undefined), undefined)).data
      }
    })
  } catch (error) {
    throw toCartError(error)
  }
}

/** A request to one of the cart's sub-resources, e.g. `cartRequest(event, '/coupon', 'DELETE')`, for updateCart. */
export function cartRequest(event: H3Event, rest: string, method: 'PUT' | 'DELETE', body?: object) {
  return (cart: Cart, token: string | undefined) =>
    serviceFetch<CartResponse>(event, 'cart', cartPath(cart, rest), { method, token, body })
}

export const itemPath = (sku: string) => `/items/${encodeURIComponent(sku)}`

/** The cart as the browser sees it: the cart composed with a pricing quote. Pricing failures degrade, not fail. */
export async function toCartView(event: H3Event, cart: Cart | null): Promise<CartView> {
  if (!cart) {
    return emptyCartView('guest')
  }

  const request = quoteRequest(cart)
  if (!request) {
    return composeCartView(cart, { status: 'empty' })
  }
  try {
    const { data: quote } = await serviceFetch<{ data: Quote }>(event, 'pricing', '/api/quotes', {
      method: 'POST',
      body: request,
    })

    return composeCartView(cart, { status: 'quoted', quote })
  } catch (error) {
    console.warn('[cart] pricing quote failed; showing the cart without totals', error)

    return composeCartView(cart, { status: 'unavailable' })
  }
}

/**
 * Moves a guest cart into the customer's cart. Never throws: a failure is logged and returns null, and the caller
 * keeps the guest cart id for a retry (merging an unknown or already merged cart is a no-op for the cart service).
 */
export async function mergeGuestCart(event: H3Event, token: string, guestCartId: string): Promise<Cart | null> {
  try {
    const { data } = await serviceFetch<CartResponse>(event, 'cart', '/api/me/cart/merge', {
      method: 'POST',
      token,
      body: { guestCartId },
    })

    return data
  } catch (error) {
    console.warn('[cart] merging the guest cart failed; retrying on the next cart request', error)

    return null
  }
}

async function mergePendingGuestCart(event: H3Event, token: string): Promise<Cart | null> {
  const guestCartId = (await sessionData(event)).secure?.guestCartId
  if (!guestCartId) {
    return null
  }
  const merged = await mergeGuestCart(event, token, guestCartId)
  if (merged) {
    await forgetGuestCart(event)
  }

  return merged
}

async function forgetGuestCart(event: H3Event): Promise<void> {
  const session = await sessionData(event)
  const secure = { ...session.secure }
  delete secure.guestCartId
  await replaceUserSession(event, { ...session, secure })
}
