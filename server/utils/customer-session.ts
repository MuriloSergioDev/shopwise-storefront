import type { H3Event } from 'h3'
import type { SecureSessionData, User } from '#auth-utils'
import type { TokenPair } from '#shared/types/contracts'

/** Refresh when the access token has less than this left, so it does not expire on its way to a service. */
const EXPIRY_SKEW_MS = 30_000

// One exchange per refresh token across all requests in this process (see refresh-coordinator.ts).
const coordinator = createRefreshCoordinator<TokenPair>({
  graceMs: 30_000,
  isRetryable: (error) => statusOf(error) !== 401,
})

interface SessionData {
  user?: User
  secure?: SecureSessionData
  [key: string]: unknown
}

/** The session's data without the `id` getUserSession adds, ready to write back. */
export async function sessionData(event: H3Event): Promise<SessionData> {
  const { id: _id, ...data } = await getUserSession(event)

  return data
}

/**
 * The signed-in customer's tokens, refreshed first when the access token is (nearly) expired or `force` is set
 * (a service answered 401). Returns null for guests. When identity rejects the refresh token the customer is
 * signed out here and treated as a guest from then on; other refresh failures (identity down) are thrown.
 */
export async function customerTokens(event: H3Event, options: { force?: boolean } = {}): Promise<SessionTokens | null> {
  const session = await sessionData(event)
  const tokens = session.secure?.tokens
  if (!session.user || !tokens) {
    return null
  }
  if (!options.force && tokens.accessExpiresAt - Date.now() > EXPIRY_SKEW_MS) {
    return tokens
  }

  let pair: TokenPair
  try {
    pair = await coordinator.refresh(tokens.refreshToken, async (refreshToken) => {
      const response = await serviceFetch<{ data: TokenPair }>(event, 'identity', '/api/tokens/refresh', {
        method: 'POST',
        body: { refreshToken },
      })

      return response.data
    })
  } catch (error) {
    if (statusOf(error) === 401) {
      await endCustomerSession(event)

      return null
    }
    throw error
  }

  const next = toSessionTokens(pair, Date.now())
  await replaceUserSession(event, { ...session, secure: { ...session.secure, tokens: next } })

  return next
}

/**
 * Drops the customer from the session (refresh failed). An unmerged guest cart id survives.
 *
 * Not clearUserSession: h3 forgets a cleared session, so the next read in the same request unseals the request's
 * cookie again and the customer comes back. replaceUserSession has the same catch (it merges top-level keys into
 * the request cookie's data), so every key is overwritten explicitly.
 */
export async function endCustomerSession(event: H3Event): Promise<void> {
  const guestCartId = (await sessionData(event)).secure?.guestCartId
  await replaceUserSession(event, {
    user: undefined,
    loggedInAt: undefined,
    secure: guestCartId ? { guestCartId } : undefined,
  })
}

/**
 * Runs a service call as the current shopper: with the customer's access token, or without one for a guest. A 401
 * gets one forced refresh and a retry, so `call` must be safe to repeat. If the refresh fails the customer is
 * signed out and the request fails with 401.
 */
export async function asShopper<T>(event: H3Event, call: (token: string | undefined) => Promise<T>): Promise<T> {
  const tokens = await customerTokens(event)
  if (!tokens) {
    return call(undefined)
  }

  try {
    return await call(tokens.accessToken)
  } catch (error) {
    if (statusOf(error) !== 401) {
      throw error
    }
    const fresh = await customerTokens(event, { force: true })
    if (!fresh) {
      throw createError({ statusCode: 401, statusMessage: 'Your session has expired. Sign in again.' })
    }

    return call(fresh.accessToken)
  }
}
