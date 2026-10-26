import { describe, expect, it } from 'vitest'
import { createError } from 'h3'
import { composeCartView, quoteRequest, toCartError } from '../../server/utils/cart-view'
import type { Cart, CartLine, Quote } from '../../shared/types/contracts'

const line = (sku: string, overrides: Partial<CartLine> = {}): CartLine => ({
  sku,
  quantity: 2,
  productSlug: 'merino-crew-tee',
  productName: 'Merino Crew Tee',
  variantName: `Tee ${sku}`,
  available: true,
  unitAmount: 4000,
  currency: 'USD',
  ...overrides,
})

const cart = (lines: CartLine[], couponCode: string | null = null): Cart => ({
  id: 'cart-1',
  owner: 'guest',
  couponCode,
  lines,
  updatedAt: '2026-10-26T00:00:00Z',
})

const quote: Quote = {
  currency: 'USD',
  lines: [{ sku: 'A', quantity: 2, unitAmount: 4500, lineAmount: 9000 }],
  subtotal: 9000,
  discount: 900,
  total: 8100,
  coupon: { code: 'TENOFF', valid: true, reason: null, description: '10% off' },
}

describe('quoteRequest', () => {
  it('prices available lines only and passes the coupon', () => {
    expect(quoteRequest(cart([line('A'), line('B', { available: false })], 'TENOFF'))).toEqual({
      lines: [{ sku: 'A', quantity: 2 }],
      couponCode: 'TENOFF',
    })
  })

  it('returns null when nothing can be priced', () => {
    expect(quoteRequest(cart([line('B', { available: false })]))).toBeNull()
  })
})

describe('composeCartView', () => {
  it("takes prices and totals from the quote and names from the cart, without the cart's id", () => {
    const view = composeCartView(cart([line('A'), line('B', { available: false, quantity: 1 })], 'TENOFF'), {
      status: 'quoted',
      quote,
    })

    expect(view).toEqual({
      owner: 'guest',
      itemCount: 3,
      currency: 'USD',
      couponCode: 'TENOFF',
      coupon: { code: 'TENOFF', valid: true, reason: null, message: null, description: '10% off' },
      totals: { subtotal: 9000, discount: 900, total: 8100 },
      lines: [
        expect.objectContaining({ sku: 'A', unitAmount: 4500, lineAmount: 9000 }),
        expect.objectContaining({ sku: 'B', available: false, unitAmount: 4000, lineAmount: null }),
      ],
    })
    expect(view).not.toHaveProperty('id')
  })

  it('explains why a coupon does not apply', () => {
    const view = composeCartView(cart([line('A')], 'BIGSPEND'), {
      status: 'quoted',
      quote: {
        ...quote,
        discount: 0,
        total: 9000,
        coupon: { code: 'BIGSPEND', valid: false, reason: 'min_subtotal_not_met', description: null },
      },
    })

    expect(view.coupon).toMatchObject({ valid: false, reason: 'min_subtotal_not_met' })
    expect(view.coupon?.message).toMatch(/minimum/)
  })

  it("falls back to the cart's display prices and no totals when pricing is unavailable", () => {
    const view = composeCartView(cart([line('A')]), { status: 'unavailable' })

    expect(view.lines[0]).toMatchObject({ unitAmount: 4000, lineAmount: 8000 })
    expect(view.totals).toBeNull()
  })

  it('has zero totals when there is nothing to price', () => {
    expect(composeCartView(cart([]), { status: 'empty' }).totals).toEqual({ subtotal: 0, discount: 0, total: 0 })
  })
})

describe('toCartError', () => {
  it('words cart validation errors for the shopper', () => {
    const error = toCartError(createError({ statusCode: 422, data: { errors: { sku: ['The sku is invalid.'] } } }))

    expect(error).toMatchObject({ statusCode: 422, statusMessage: 'This item is not for sale any more.' })
  })

  it('leaves other errors alone', () => {
    const error = createError({ statusCode: 502 })

    expect(toCartError(error)).toBe(error)
  })
})
