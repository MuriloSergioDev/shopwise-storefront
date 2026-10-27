import { z } from 'zod'
import type { OrderPage } from '#shared/types/contracts'

const query = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
})

/** The customer's orders, newest first. */
export default defineEventHandler(async (event) => {
  const { page } = await getValidatedQuery(event, query.parse)

  return asCustomer(event, (token) =>
    serviceFetch<OrderPage>(event, 'orders', '/api/me/orders', { token, query: { page, perPage: 20 } }),
  )
})
