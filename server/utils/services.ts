import type { H3Event } from 'h3'
import { ofetch } from 'ofetch'
import type { Customer, TokenPair } from '#shared/types/contracts'

export type Service = 'identity' | 'catalog' | 'pricing' | 'cart'

interface ServiceFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Array values repeat the key (`skus[]=a&skus[]=b` for `{ 'skus[]': ['a', 'b'] }`). */
  query?: Record<string, string | number | string[]>
  body?: object
  /** Access token to send as `Bearer`. */
  token?: string
}

/**
 * The only way the BFF talks to a service: resolves its base URL, attaches the bearer token and the incoming
 * `traceparent`, and maps failures through toBffError.
 */
export async function serviceFetch<T>(
  event: H3Event,
  service: Service,
  path: string,
  options: ServiceFetchOptions = {},
): Promise<T> {
  const config = useRuntimeConfig(event)
  const baseURL = {
    identity: config.identityUrl,
    catalog: config.catalogUrl,
    pricing: config.pricingUrl,
    cart: config.cartUrl,
  }[service]

  const headers: Record<string, string> = { accept: 'application/json' }
  if (options.token) {
    headers.authorization = `Bearer ${options.token}`
  }
  const traceparent = getRequestHeader(event, 'traceparent')
  if (traceparent) {
    headers.traceparent = traceparent
  }

  try {
    return await ofetch<T>(path, {
      baseURL,
      method: options.method ?? 'GET',
      query: options.query,
      body: options.body as Record<string, unknown> | undefined,
      headers,
      timeout: 5000,
    })
  } catch (error) {
    throw toBffError(service, error)
  }
}

/** The HTTP status of a failed serviceFetch (or any H3 error). */
export function statusOf(error: unknown): number | undefined {
  const status = (error as { statusCode?: unknown } | null)?.statusCode

  return typeof status === 'number' ? status : undefined
}

/**
 * Signs the customer in with a fresh token pair: loads their profile, merges the guest cart they built while
 * signed out, and seals the tokens into the session cookie. A failed merge does not fail the sign-in: the guest
 * cart id stays in the session and the next cart request retries it.
 */
export async function startSession(event: H3Event, pair: TokenPair): Promise<Customer> {
  const { data: customer } = await serviceFetch<{ data: Customer }>(event, 'identity', '/api/me', {
    token: pair.accessToken,
  })
  const guestCartId = (await getUserSession(event)).secure?.guestCartId
  const merged = guestCartId ? await mergeGuestCart(event, pair.accessToken, guestCartId) : null

  await replaceUserSession(event, {
    user: { id: customer.id, email: customer.email, name: customer.name, roles: customer.roles },
    secure: {
      tokens: toSessionTokens(pair, Date.now()),
      ...(guestCartId && !merged ? { guestCartId } : {}),
    },
    loggedInAt: Date.now(),
  })

  return customer
}
