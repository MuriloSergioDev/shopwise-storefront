import type { Checkout, FailureReason } from '../types/contracts'

/** The saga is over: nothing will change any more. */
export const isFinal = (checkout: Pick<Checkout, 'status'>) =>
  checkout.status === 'completed' || checkout.status === 'failed'

/** The order exists (closing_cart already has one): the shopper can be told it was placed. */
export const isPlaced = (checkout: Pick<Checkout, 'status' | 'orderId'>) =>
  checkout.orderId !== null && (checkout.status === 'closing_cart' || checkout.status === 'completed')

const FAILURES: Record<FailureReason, string> = {
  out_of_stock: 'Some items sold out before we could reserve them. You have not been charged.',
  payment_failed: 'Your payment was declined. You have not been charged.',
  reservation_expired: 'Your items were held for too long and were released. Any payment has been refunded.',
  order_rejected: 'We could not place your order. Any payment has been refunded.',
  timeout: 'Checkout took too long and was cancelled. Any payment has been refunded.',
}

/** Why the checkout failed, worded for the shopper; null while it has not failed. */
export function failureMessage(checkout: Pick<Checkout, 'failureReason' | 'paymentFailure'>): string | null {
  if (!checkout.failureReason) {
    return null
  }
  // Payments' message is safe to show (checkout.yaml) and says more than our generic one ("Your card was declined.").
  if (checkout.failureReason === 'payment_failed' && checkout.paymentFailure?.message) {
    return `${checkout.paymentFailure.message} You have not been charged.`
  }

  return FAILURES[checkout.failureReason]
}

const STEPS: Record<Checkout['status'], string> = {
  reserving: 'Reserving your items…',
  paying: 'Taking payment…',
  committing_stock: 'Confirming your items…',
  placing_order: 'Placing your order…',
  closing_cart: 'Order placed.',
  completed: 'Order placed.',
  compensating: 'Undoing the checkout…',
  failed: 'Checkout failed.',
}

export const stepLabel = (status: Checkout['status']) => STEPS[status]
