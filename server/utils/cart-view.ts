import { createError, isError } from 'h3'
import type { Cart, CouponReason, Quote } from '#shared/types/contracts'
import type { CartView, CartViewCoupon } from '#shared/types/cart'

export type CartPricing = { status: 'quoted'; quote: Quote } | { status: 'empty' } | { status: 'unavailable' }

/** What to ask pricing for: available lines only (the rest cannot be bought), or null when nothing is left. */
export function quoteRequest(cart: Pick<Cart, 'lines' | 'couponCode'>) {
  const lines = cart.lines.filter((line) => line.available).map(({ sku, quantity }) => ({ sku, quantity }))
  if (lines.length === 0) {
    return null
  }

  return cart.couponCode ? { lines, couponCode: cart.couponCode } : { lines }
}

const COUPON_MESSAGES: Record<CouponReason, string> = {
  unknown: 'This coupon code is not valid.',
  not_started: 'This coupon is not active yet.',
  expired: 'This coupon has expired.',
  min_subtotal_not_met: 'Your order does not reach the minimum for this coupon yet.',
  already_redeemed: 'You have already used this coupon.',
  exhausted: 'This coupon has been used up.',
}

export function couponMessage(reason: CouponReason | null): string | null {
  return reason ? COUPON_MESSAGES[reason] : null
}

/**
 * Composes the cart service's lines (names, availability, last known prices) with pricing's quote (current prices,
 * totals, coupon verdict). Without a quote the lines keep the cart's display prices and totals are null.
 */
export function composeCartView(cart: Pick<Cart, 'owner' | 'lines' | 'couponCode'>, pricing: CartPricing): CartView {
  const quote = pricing.status === 'quoted' ? pricing.quote : null
  const quoted = new Map(quote?.lines.map((line) => [line.sku, line]))

  const lines = cart.lines.map((line) => {
    const priced = quoted.get(line.sku)
    const unitAmount = priced ? priced.unitAmount : line.unitAmount
    const lineAmount = priced
      ? priced.lineAmount
      : line.available && line.unitAmount !== null
        ? line.unitAmount * line.quantity
        : null

    return {
      sku: line.sku,
      quantity: line.quantity,
      productSlug: line.productSlug,
      productName: line.productName,
      variantName: line.variantName,
      available: line.available,
      unitAmount,
      lineAmount,
    }
  })

  const coupon: CartViewCoupon | null = quote?.coupon
    ? { ...quote.coupon, message: couponMessage(quote.coupon.reason) }
    : null

  return {
    owner: cart.owner,
    itemCount: cart.lines.reduce((sum, line) => sum + line.quantity, 0),
    currency: quote?.currency ?? cart.lines.find((line) => line.currency)?.currency ?? 'USD',
    lines,
    couponCode: cart.couponCode,
    coupon,
    totals: quote
      ? { subtotal: quote.subtotal, discount: quote.discount, total: quote.total }
      : pricing.status === 'empty'
        ? { subtotal: 0, discount: 0, total: 0 }
        : null,
  }
}

export function emptyCartView(owner: Cart['owner']): CartView {
  return composeCartView({ owner, lines: [], couponCode: null }, { status: 'empty' })
}

/** Turns the cart service's validation errors (422) into messages a shopper can act on; other errors pass. */
export function toCartError(error: unknown): unknown {
  if (!isError(error) || error.statusCode !== 422) {
    return error
  }

  const errors = (error.data as { errors?: Record<string, string[]> } | undefined)?.errors ?? {}
  let message = 'Your cart could not be updated.'
  if (errors.sku) {
    message = 'This item is not for sale any more.'
  } else if (errors.items) {
    message = 'Your cart is full: it holds up to 50 different items.'
  } else if (errors.quantity) {
    message = 'Choose a quantity from 1 to 99.'
  } else if (errors.code) {
    message = 'Coupon codes use only letters, numbers, - and _.'
  }

  return createError({ statusCode: 422, statusMessage: message, data: { errors } })
}
