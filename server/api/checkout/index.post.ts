import { z } from 'zod'
import type { Checkout } from '#shared/types/contracts'

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null)

const start = z.object({
  /** One per checkout attempt, made by the page: a repeated submit returns the same checkout. */
  attemptId: z.uuid(),
  paymentMethodId: z
    .string()
    .max(255)
    .regex(/^pm_[A-Za-z0-9_]+$/),
  shippingAddress: z.object({
    name: z.string().trim().min(1).max(100),
    line1: z.string().trim().min(1).max(200),
    line2: optional(200),
    city: z.string().trim().min(1).max(100),
    region: optional(100),
    postalCode: z.string().trim().min(1).max(20),
    country: z.string().regex(/^[A-Z]{2}$/),
  }),
})

/**
 * Starts the checkout saga for the customer's cart. Checkout takes the cart snapshot and the pricing quote before it
 * answers, so a bad cart or coupon fails here (422); otherwise the answer is 202 and the page polls
 * GET /api/checkout/{id}.
 */
export default defineEventHandler(async (event) => {
  const { attemptId, paymentMethodId, shippingAddress } = await readValidatedBody(event, start.parse)

  try {
    const checkout = await asCustomer(event, async (token) => {
      const cart = await findCart(event, token)
      if (!cart || cart.lines.length === 0) {
        throw createError({ statusCode: 422, statusMessage: 'Your cart is empty.' })
      }

      return serviceFetch<{ data: Checkout }>(event, 'checkout', '/api/checkouts', {
        method: 'POST',
        token,
        headers: { 'idempotency-key': attemptId },
        body: { cartId: cart.id, paymentMethodId, shippingAddress },
      })
    })
    setResponseStatus(event, 202)

    return checkout
  } catch (error) {
    throw toCheckoutError(error)
  }
})
