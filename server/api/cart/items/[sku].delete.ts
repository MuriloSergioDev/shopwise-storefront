import { z } from 'zod'

const params = z.object({ sku: z.string().min(1).max(64) })

export default defineEventHandler(async (event) => {
  const { sku } = await getValidatedRouterParams(event, params.parse, { decode: true })
  const cart = await updateCart(event, cartRequest(event, itemPath(sku), 'DELETE'))

  return { data: await toCartView(event, cart) }
})
