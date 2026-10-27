import { z } from 'zod'
import type { Checkout } from '#shared/types/contracts'

const params = z.object({ id: z.string().regex(resourceId) })
const body = z.object({ outcome: z.enum(['succeeded', 'failed']) })

/**
 * Dev only (test-card mode, no Stripe key): finishes the 3-D Secure step of the customer's own checkout through
 * payments' fake gateway (`POST /api/dev/payment-actions`), as the bank and Stripe's webhook would. 404 otherwise.
 */
export default defineEventHandler(async (event) => {
  const { stripePublishableKey, testCards } = useRuntimeConfig(event).public
  if (stripePublishableKey || !testCards) {
    throw createError({ statusCode: 404 })
  }
  const { id } = await getValidatedRouterParams(event, params.parse)
  const { outcome } = await readValidatedBody(event, body.parse)

  // Reading it as the customer proves it is theirs; the client secret is only set while the action is pending.
  const { data: checkout } = await asCustomer(event, (token) =>
    serviceFetch<{ data: Checkout }>(event, 'checkout', `/api/checkouts/${id}`, { token }),
  )
  if (checkout.status !== 'awaiting_payment_action' || !checkout.clientSecret) {
    throw createError({ statusCode: 409, statusMessage: 'This checkout is not waiting for 3-D Secure.' })
  }
  await serviceFetch(event, 'payments', '/api/dev/payment-actions', {
    method: 'POST',
    body: { clientSecret: checkout.clientSecret, outcome },
  })

  return { data: { outcome } }
})
