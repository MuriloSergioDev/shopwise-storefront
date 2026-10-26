export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const tokens = session.secure?.tokens
  if (tokens) {
    // Revoking is best effort: the cookie goes either way and access tokens expire on their own.
    await serviceFetch(event, 'identity', '/api/tokens/revoke', {
      method: 'POST',
      body: { refreshToken: tokens.refreshToken },
    }).catch(() => undefined)
  }
  await clearUserSession(event)
  setResponseStatus(event, 204)

  return null
})
