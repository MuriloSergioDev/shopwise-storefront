/**
 * Refreshes a signed-in customer's access token before it expires, on every request that carries the session
 * cookie, including page requests. Page requests matter: during SSR, `useFetch` calls the BFF internally and the
 * Set-Cookie of those internal responses never reaches the browser, so a refresh done only inside an API handler
 * would spend the refresh token without the browser ever receiving the new one. Refreshing here puts the new
 * cookie on the page response; the internal calls (which still carry the old cookie) get the same new pair from
 * the refresh coordinator instead of reusing the spent token.
 */
export default defineEventHandler(async (event) => {
  if (event.path.startsWith('/api/auth/') || event.path.startsWith('/_nuxt/')) {
    return
  }
  const name = (useRuntimeConfig(event).session as { name?: string } | undefined)?.name ?? 'nuxt-session'
  if (!getCookie(event, name)) {
    return
  }

  // Identity being down is not this request's problem: routes that need a token fail on their own.
  await customerTokens(event).catch(() => undefined)
})
