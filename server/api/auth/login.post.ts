import { z } from 'zod'
import type { TokenPair } from '#shared/types/contracts'

const credentials = z.object({
  email: z.email().max(255),
  password: z.string().min(1).max(200),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, credentials.parse)
  const { data: pair } = await serviceFetch<{ data: TokenPair }>(event, 'identity', '/api/tokens', {
    method: 'POST',
    body,
  })
  const customer = await startSession(event, pair)

  return { data: customer }
})
