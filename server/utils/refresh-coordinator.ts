/**
 * Makes sure each refresh token is exchanged at most once, however many requests need it.
 *
 * Identity rotates refresh tokens and revokes the whole family when a spent one comes back. A customer's parallel
 * requests carry the same sealed cookie, so they all hold the same refresh token: the first caller starts the
 * exchange and every other caller gets the same promise. Settled results stay for `graceMs` because a request can
 * still arrive with the old cookie after the exchange (the browser had not stored the new cookie yet, or an SSR
 * render's internal fetch forwards the page request's cookie). Those requests get the new pair instead of
 * reusing the spent token.
 *
 * Failures that `isRetryable` accepts (network, 5xx) are forgotten right away so a later request can try again;
 * definitive ones (identity said 401) are kept for the grace window like successes.
 *
 * In-process only: with more than one BFF replica this would need a shared lock (e.g. Redis).
 */
export function createRefreshCoordinator<T>(options: {
  graceMs: number
  isRetryable: (error: unknown) => boolean
  now?: () => number
}) {
  const now = options.now ?? Date.now
  const entries = new Map<string, { promise: Promise<T>; settledAt?: number }>()

  function sweep() {
    const cutoff = now() - options.graceMs
    for (const [key, entry] of entries) {
      if (entry.settledAt !== undefined && entry.settledAt < cutoff) {
        entries.delete(key)
      }
    }
  }

  return {
    refresh(refreshToken: string, exchange: (refreshToken: string) => Promise<T>): Promise<T> {
      sweep()
      const existing = entries.get(refreshToken)
      if (existing) {
        return existing.promise
      }

      const entry: { promise: Promise<T>; settledAt?: number } = { promise: exchange(refreshToken) }
      entries.set(refreshToken, entry)
      entry.promise.then(
        () => {
          entry.settledAt = now()
        },
        (error: unknown) => {
          if (options.isRetryable(error)) {
            entries.delete(refreshToken)
          } else {
            entry.settledAt = now()
          }
        },
      )

      return entry.promise
    },
    /** For tests. */
    get size() {
      return entries.size
    },
  }
}
