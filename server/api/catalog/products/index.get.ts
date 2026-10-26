import type { ProductSearchResult } from '#shared/types/contracts'

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, toProductSearchQuery)

  return serviceFetch<ProductSearchResult>(event, 'catalog', '/api/products', { query })
})
