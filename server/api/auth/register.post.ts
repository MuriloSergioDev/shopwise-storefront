import { z } from 'zod'
import type { TokenPair } from '#shared/types/contracts'

const registration = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email().max(255),
  password: z.string().min(8).max(200),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, registration.parse)
  const { data: pair } = await serviceFetch<{ data: TokenPair }>(event, 'identity', '/api/customers', {
    method: 'POST',
    body,
  })
  const { customer, droppedSkus } = await startSession(event, pair)
  setResponseStatus(event, 201)

  // droppedSkus: guest cart items that did not fit into the customer cart (50 lines at most).
  return { data: customer, meta: { droppedSkus } }
})
