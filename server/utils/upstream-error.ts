import { createError, type H3Error } from 'h3'
import { FetchError } from 'ofetch'

interface UpstreamBody {
  message?: string
  errors?: Record<string, string[]>
  /** Machine-readable reason, e.g. cart's `cart_locked` (with the `checkoutId` holding the lock). */
  code?: string
  checkoutId?: string
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
      data: toErrorData(body),
    })
  }

  return createError({ statusCode: 502, statusMessage: `The ${service} service is unavailable.` })
}

/** The parts of a service's error body the BFF passes on: validation errors and a machine-readable code. */
function toErrorData(body: UpstreamBody | undefined) {
  const data = {
    ...(body?.errors ? { errors: body.errors } : {}),
    ...(body?.code ? { code: body.code } : {}),
    ...(body?.code && body.checkoutId ? { checkoutId: body.checkoutId } : {}),
  }

  return Object.keys(data).length > 0 ? data : undefined
}
