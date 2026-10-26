import type { Category } from '#shared/types/contracts'

export default defineEventHandler((event) => serviceFetch<{ data: Category[] }>(event, 'catalog', '/api/categories'))
