import { z } from 'zod'
import type { Checkout } from '#shared/types/contracts'

const params = z.object({ id: z.string().regex(resourceId) })

/** The checkout and where its saga is. The page polls this until status is completed or failed. */
export default defineEventHandler(async (event) => {
  const { id } = await getValidatedRouterParams(event, params.parse)

  return asCustomer(event, (token) =>
    serviceFetch<{ data: Checkout }>(event, 'checkout', `/api/checkouts/${id}`, { token }),
  )
})
