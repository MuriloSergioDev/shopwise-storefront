import type { H3Event } from 'h3'
import { ofetch } from 'ofetch'
import type { Customer, TokenPair } from '#shared/types/contracts'

export type Service = 'identity' | 'catalog'

interface ServiceFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  query?: Record<string, string | number>
  body?: Record<string, unknown>
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
  const baseURL = service === 'identity' ? config.identityUrl : config.catalogUrl

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
      body: options.body,
      headers,
      timeout: 5000,
    })
  } catch (error) {
    throw toBffError(service, error)
  }
}

/** Signs the customer in with a fresh token pair: loads their profile and seals both into the session cookie. */
export async function startSession(event: H3Event, pair: TokenPair): Promise<Customer> {
  const { data: customer } = await serviceFetch<{ data: Customer }>(event, 'identity', '/api/me', {
    token: pair.accessToken,
  })
  await replaceUserSession(event, {
    user: { id: customer.id, email: customer.email, name: customer.name, roles: customer.roles },
    secure: toSessionTokens(pair, Date.now()),
    loggedInAt: Date.now(),
  })

  return customer
}
