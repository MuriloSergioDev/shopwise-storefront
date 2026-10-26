/** The error message a BFF failure carries (its statusMessage), or `fallback` for network and unexpected errors. */
export function errorMessageOf(error: unknown, fallback: string): string {
  const message = (error as { data?: { statusMessage?: unknown } } | null)?.data?.statusMessage

  return typeof message === 'string' && message !== '' ? message : fallback
}

/** A same-site path to return to after signing in; anything else (absolute or protocol-relative URLs) goes home. */
export function safeRedirect(target: unknown): string {
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//') ? target : '/'
}
