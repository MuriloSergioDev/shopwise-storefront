import type { H3Event } from 'h3'
import { createError, isError } from 'h3'
import type { CouponReason } from '#shared/types/contracts'

/**
 * Runs a service call as the signed-in customer (refresh + retry once on 401, like asShopper). Guests get a 401:
 * only customers can check out or have orders (ADR-0004).
 */
export function asCustomer<T>(event: H3Event, call: (token: string) => Promise<T>): Promise<T> {
  return asShopper(event, (token) => {
    if (!token) {
      throw createError({ statusCode: 401, statusMessage: 'Sign in to continue.' })
    }

    return call(token)
  })
}

/** Ids of checkouts and orders as they appear in BFF paths. */
export const resourceId = /^[0-9A-Za-z_-]{1,64}$/

/**
 * Turns checkout's refusals (422 bad cart or coupon, 409 another checkout in progress, 404 no cart) into messages a
 * shopper can act on; other errors pass.
 */
export function toCheckoutError(error: unknown): unknown {
  if (!isError(error)) {
    return error
  }
  if (error.statusCode === 409) {
    return createError({ statusCode: 409, statusMessage: 'Your cart already has a checkout in progress.' })
  }
  if (error.statusCode === 404) {
    return createError({ statusCode: 422, statusMessage: 'Your cart could not be found. Reload the page.' })
  }
  if (error.statusCode !== 422) {
    return error
  }

  const errors = (error.data as { errors?: Record<string, string[]> } | undefined)?.errors
  if (!errors) {
    // Already worded by the BFF (an empty cart).
    return error
  }
  let message = 'Your order could not be placed.'
  if (errors.couponCode) {
    message = couponMessage((errors.couponCode[0] ?? 'unknown') as CouponReason) ?? message
  } else if (errors.cartId?.[0]?.startsWith('No longer for sale')) {
    message = 'Some items in your cart are no longer for sale. Remove them to continue.'
  } else if (errors.cartId) {
    message = 'Your cart is empty.'
  } else if (errors.lines) {
    message = 'Some items in your cart have no price right now. Try again later.'
  } else if (errors.paymentMethodId) {
    message = 'The payment method was not accepted.'
  } else if (errors['shippingAddress.country']) {
    message = 'Choose a country for the shipping address.'
  } else if (Object.keys(errors).some((field) => field.startsWith('shippingAddress'))) {
    message = 'Check the shipping address.'
  }

  return createError({ statusCode: 422, statusMessage: message, data: { errors } })
}
