import { describe, expect, it } from 'vitest'
import { FetchError } from 'ofetch'
import { toBffError } from '../../server/utils/upstream-error'

function fetchError(status: number, data?: unknown): FetchError {
  const error = new FetchError('upstream failed')
  Object.assign(error, { response: new Response(null, { status }), data })

  return error
}

describe('toBffError', () => {
  it('passes client errors through with the service message and validation errors', () => {
    const error = toBffError(
      'identity',
      fetchError(422, { message: 'These credentials do not match our records.', errors: { email: ['bad'] } }),
    )

    expect(error.statusCode).toBe(422)
    expect(error.statusMessage).toBe('These credentials do not match our records.')
    expect(error.data).toEqual({ errors: { email: ['bad'] } })
  })

  it("passes a service's error code on, e.g. cart's cart_locked with the checkout holding the lock", () => {
    const error = toBffError(
      'cart',
      fetchError(409, { message: 'This cart is being checked out.', code: 'cart_locked', checkoutId: 'checkout-1' }),
    )

    expect(error.statusCode).toBe(409)
    expect(error.data).toEqual({ code: 'cart_locked', checkoutId: 'checkout-1' })
  })

  it('keeps 404s as 404s', () => {
    expect(toBffError('catalog', fetchError(404)).statusCode).toBe(404)
  })

  it('hides server errors and network failures behind a 502', () => {
    const serverError = toBffError('catalog', fetchError(500, { message: 'SQLSTATE[42P01]: relation missing' }))
    const networkError = toBffError('catalog', new TypeError('fetch failed'))

    for (const error of [serverError, networkError]) {
      expect(error.statusCode).toBe(502)
      expect(error.statusMessage).toBe('The catalog service is unavailable.')
    }
  })
})
