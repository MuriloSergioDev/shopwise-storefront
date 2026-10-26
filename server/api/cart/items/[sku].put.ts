import { z } from 'zod'

const params = z.object({ sku: z.string().min(1).max(64) })
const body = z.object({ quantity: z.number().int().min(1).max(99) })

export default defineEventHandler(async (event) => {
  const { sku } = await getValidatedRouterParams(event, params.parse, { decode: true })
  const { quantity } = await readValidatedBody(event, body.parse)
  const cart = await updateCart(event, cartRequest(event, itemPath(sku), 'PUT', { quantity }))

  return { data: await toCartView(event, cart) }
})
