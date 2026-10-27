<script setup lang="ts">
import type { Stripe, StripeElements } from '@stripe/stripe-js'

// The card never reaches the BFF: with a publishable key, Stripe's Payment Element turns it into a PaymentMethod in
// the browser and only its id (pm_…) is sent. Without one (local dev), Stripe's test PaymentMethods are offered;
// payments' fake gateway knows them (and so does Stripe test mode).
const props = defineProps<{ amount: number; currency: string }>()

const publishableKey = useRuntimeConfig().public.stripePublishableKey
const mode = usePaymentMode()

const TEST_CARDS = [
  { value: 'pm_card_visa', label: 'Visa ending 4242', description: 'Payment succeeds.' },
  { value: 'pm_card_chargeDeclined', label: 'Visa ending 0002', description: 'Payment is declined.' },
  {
    value: 'pm_card_threeDSecure2Required',
    label: 'Visa ending 3220',
    description: 'Needs 3-D Secure; the next page lets you finish it.',
  },
]
const testCard = ref(TEST_CARDS[0]!.value)

const container = ref<HTMLElement>()
const loadError = ref<string>()
let stripe: Stripe | null = null
let elements: StripeElements | null = null

onMounted(async () => {
  if (mode !== 'stripe') {
    return
  }
  try {
    const { loadStripe } = await import('@stripe/stripe-js')
    stripe = await loadStripe(publishableKey)
    if (!stripe || !container.value) {
      throw new Error('Stripe.js did not load')
    }
    // Deferred intent: payments creates and confirms the PaymentIntent server-side (no redirects), so only cards.
    elements = stripe.elements({
      mode: 'payment',
      amount: props.amount,
      currency: props.currency.toLowerCase(),
      paymentMethodCreation: 'manual',
      allowedPaymentMethodTypes: ['card'],
    })
    elements.create('payment').mount(container.value)
  } catch {
    loadError.value = 'The payment form could not be loaded. Reload the page.'
  }
})

watch(
  () => props.amount,
  (amount) => elements?.update({ amount }),
)

/** The PaymentMethod id to check out with. Throws an Error whose message is worded for the shopper. */
async function createPaymentMethod(): Promise<string> {
  if (mode === 'test-cards') {
    return testCard.value
  }
  if (!stripe || !elements) {
    throw new Error(loadError.value ?? 'Payments are not available right now.')
  }
  const submitted = await elements.submit()
  if (submitted.error) {
    throw new Error(submitted.error.message ?? 'Check your card details.')
  }
  const { error, paymentMethod } = await stripe.createPaymentMethod({ elements })
  if (error || !paymentMethod) {
    throw new Error(error?.message ?? 'Your card could not be used.')
  }

  return paymentMethod.id
}

defineExpose({ createPaymentMethod })
</script>

<template>
  <div>
    <div v-if="mode === 'stripe'">
      <div ref="container" data-test="stripe-payment-element" />
      <p v-if="loadError" class="mt-2 text-sm text-error">{{ loadError }}</p>
    </div>

    <div v-else-if="mode === 'test-cards'" class="space-y-3">
      <UAlert
        color="info"
        variant="subtle"
        icon="i-lucide-flask-conical"
        title="Test mode"
        description="No Stripe key is configured. Pick a Stripe test card; no real payment is made."
      />
      <URadioGroup v-model="testCard" :items="TEST_CARDS" legend="Test card" variant="card" />
    </div>

    <UAlert v-else color="warning" variant="subtle" icon="i-lucide-circle-alert" title="Payments are not configured." />
  </div>
</template>
