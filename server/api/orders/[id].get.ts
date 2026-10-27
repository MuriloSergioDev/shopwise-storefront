import { z } from 'zod'
import type { Order } from '#shared/types/contracts'

const params = z.object({ id: z.string().regex(resourceId) })

export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, params.parse)

  return asCustomer(event, (token) => serviceFetch<{ data: Order }>(event, 'orders', `/api/me/orders/${id}`, { token }))
})
