import { z } from 'zod'

const addition = z.object({
  sku: z.string().trim().min(1).max(64),
  quantity: z.number().int().min(1).max(99).default(1),
})

/** Adds to the quantity already in the cart (capped at 99). A guest's first add creates their cart. */
export default defineEventHandler(async (event) => {
  const { sku, quantity } = await readValidatedBody(event, addition.parse)
  const cart = await updateCart(event, (current, token) => {
    const existing = current.lines.find((line) => line.sku === sku)?.quantity ?? 0

    return cartRequest(event, itemPath(sku), 'PUT', { quantity: Math.min(existing + quantity, 99) })(current, token)
  })

  return { data: await toCartView(event, cart) }
})
