export type PaymentMode = 'stripe' | 'test-cards' | 'unavailable'

/**
 * How the browser takes payments: Stripe.js with a publishable key, Stripe's test PaymentMethods for payments' fake
 * gateway (dev only, NUXT_PUBLIC_TEST_CARDS), or not at all.
 */
export function usePaymentMode(): PaymentMode {
  const { stripePublishableKey, testCards } = useRuntimeConfig().public

  return stripePublishableKey ? 'stripe' : testCards ? 'test-cards' : 'unavailable'
}

/** Runs the bank's 3-D Secure challenge for a PaymentIntent that needs it (checkout's awaiting_payment_action). */
export function usePaymentAction() {
  const mode = usePaymentMode()
  const publishableKey = useRuntimeConfig().public.stripePublishableKey

  /** Resolves with a message worded for the shopper when the challenge could not run or failed, else null. */
  async function handleNextAction(clientSecret: string): Promise<string | null> {
    try {
      const { loadStripe } = await import('@stripe/stripe-js')
      const stripe = await loadStripe(publishableKey)
      if (!stripe) {
        return 'The payment confirmation could not be loaded. Reload the page.'
      }
      const { error } = await stripe.handleNextAction({ clientSecret })

      return error ? (error.message ?? 'The payment was not confirmed.') : null
    } catch {
      return 'The payment confirmation could not be loaded. Reload the page.'
    }
  }

  return { mode, handleNextAction }
}
