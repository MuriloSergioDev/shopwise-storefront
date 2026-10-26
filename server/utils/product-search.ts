import { z } from 'zod'

const OPTION_KEY = /^options\[([a-z0-9_-]{1,50})\]$/

const searchQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
  perPage: z.coerce.number().int().min(1).max(48).optional(),
})

/**
 * Validates the browser's search query and builds catalog's: known keys plus `options[<name>]=<value>`
 * filters (one value per option name). Empty values are dropped so `?q=` means "no search".
 */
export function toProductSearchQuery(input: unknown): Record<string, string | number> {
  const raw = z.record(z.string(), z.unknown()).parse(input)
  const known = searchQuery.parse(Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== '')))

  const query: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(known)) {
    if (value !== undefined && value !== '') {
      query[key] = value
    }
  }
  for (const [key, value] of Object.entries(raw)) {
    const name = OPTION_KEY.exec(key)?.[1]
    if (name && typeof value === 'string' && value !== '') {
      query[`options[${name}]`] = z.string().max(50).parse(value)
    }
  }

  return query
}
