import { z } from 'zod'
import type { Price } from '#shared/types/contracts'

const sku = z.string().trim().min(1).max(64)
const query = z.object({
  'skus[]': z
    .union([sku, z.array(sku)])
    .transform((value) => (Array.isArray(value) ? value : [value]))
    .pipe(z.array(sku).min(1).max(100)),
})

/** Current prices for `?skus[]=A&skus[]=B`. SKUs without a price are left out. */
export default defineEventHandler(async (event) => {
  const { 'skus[]': skus } = await getValidatedQuery(event, query.parse)

  return serviceFetch<{ data: Price[] }>(event, 'pricing', '/api/prices', { query: { 'skus[]': skus } })
})
