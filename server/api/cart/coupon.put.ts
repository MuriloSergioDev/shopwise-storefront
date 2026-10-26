import { z } from 'zod'

const coupon = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Enter a coupon code.')
    .max(32, 'Coupon codes are at most 32 characters.')
    .regex(/^[A-Za-z0-9_-]+$/, 'Coupon codes use only letters, numbers, - and _.'),
})

/** Stores the code on the cart; whether it applies comes back in the view's `coupon` (from the pricing quote). */
export default defineEventHandler(async (event) => {
  const { code } = await readValidatedBody(event, coupon.parse)
  const cart = await updateCart(event, cartRequest(event, '/coupon', 'PUT', { code }))

  return { data: await toCartView(event, cart) }
})
