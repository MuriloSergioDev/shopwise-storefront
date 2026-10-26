import { z } from 'zod'
import type { Product } from '#shared/types/contracts'

const params = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(200),
})

export default defineEventHandler(async (event) => {
  const { slug } = await getValidatedRouterParams(event, params.parse)

  return serviceFetch<{ data: Product }>(event, 'catalog', `/api/products/${slug}`)
})
