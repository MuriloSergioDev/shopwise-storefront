import { createError, type H3Error } from 'h3'
import { FetchError } from 'ofetch'

interface UpstreamBody {
  message?: string
  errors?: Record<string, string[]>
}

/**
 * Turns a failed service call into the error the browser sees. Client errors (4xx) pass through with the
 * service's message and validation errors; anything else becomes a 502 so service internals never leak.
 */
export function toBffError(service: string, error: unknown): H3Error {
  const status = error instanceof FetchError ? error.response?.status : undefined
  if (status !== undefined && status >= 400 && status < 500) {
    const body = (error as FetchError<UpstreamBody>).data
    return createError({
      statusCode: status,
      statusMessage: body?.message ?? undefined,
      data: body?.errors ? { errors: body.errors } : undefined,
    })
  }

  return createError({ statusCode: 502, statusMessage: `The ${service} service is unavailable.` })
}
