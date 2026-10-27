import type { Address, Checkout } from '#shared/types/contracts'

export interface CheckoutRequest {
  /** One per attempt: submitting the same attempt twice returns the same checkout. */
  attemptId: string
  paymentMethodId: string
  shippingAddress: Address
}

/** Starts a checkout for the customer's cart. Failures throw a message worded for the shopper (errorMessageOf). */
export async function startCheckout(request: CheckoutRequest): Promise<Checkout> {
  const { data } = await $fetch('/api/checkout', { method: 'POST', body: request })

  return data
}

/** One checkout, for polling with `refresh()` until it is final. */
export function useCheckoutStatus(id: MaybeRefOrGetter<string>) {
  return useFetch(() => `/api/checkout/${toValue(id)}`, {
    key: () => `checkout-${toValue(id)}`,
    transform: (response) => response.data,
  })
}
