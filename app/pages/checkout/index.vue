<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import PaymentStep from '~/components/PaymentStep.vue'

definePageMeta({ middleware: 'customer' })
useSeoMeta({ title: 'Checkout · Shopwise' })

const { data: cart, error } = await useCart()
const { user } = useUserSession()

const COUNTRIES = [
  { value: 'US', label: 'United States' },
  { value: 'CA', label: 'Canada' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'BR', label: 'Brazil' },
]

const schema = z.object({
  name: z.string().trim().min(1, 'Enter the recipient’s name').max(100),
  line1: z.string().trim().min(1, 'Enter the street address').max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1, 'Enter the city').max(100),
  region: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().min(1, 'Enter the postal code').max(20),
  country: z.string().regex(/^[A-Z]{2}$/, 'Choose a country'),
})
type AddressForm = z.output<typeof schema>

const address = reactive<Partial<AddressForm>>({ name: user.value?.name ?? '', country: 'US' })

const payment = ref<InstanceType<typeof PaymentStep>>()
const placing = ref(false)
const placeError = ref<string>()
// A new attempt id only after a failure the shopper can fix: double clicks and retries reuse the same checkout.
let attemptId = crypto.randomUUID()

const money = (amount: number) => (cart.value ? formatMoney(amount, cart.value.currency) : '')
const canCheckout = computed(
  () =>
    !!cart.value &&
    !cart.value.lockedByCheckoutId &&
    cart.value.lines.length > 0 &&
    cart.value.lines.every((line) => line.available) &&
    cart.value.totals !== null &&
    cart.value.coupon?.valid !== false,
)

async function placeOrder({ data }: FormSubmitEvent<AddressForm>) {
  placeError.value = undefined
  placing.value = true
  try {
    const paymentMethodId = await payment.value!.createPaymentMethod()
    const checkout = await startCheckout({
      attemptId,
      paymentMethodId,
      shippingAddress: {
        ...data,
        line2: data.line2 || null,
        region: data.region || null,
      },
    })
    await navigateTo(`/checkout/${checkout.id}`)
  } catch (failure) {
    placeError.value =
      failure instanceof Error && !('data' in failure)
        ? failure.message
        : errorMessageOf(failure, 'Your order could not be placed. Try again.')
    attemptId = crypto.randomUUID()
  } finally {
    placing.value = false
  }
}
</script>

<template>
  <UContainer class="py-8">
    <h1 class="mb-6 text-3xl font-bold text-highlighted">Checkout</h1>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Your cart could not be loaded."
    />

    <div v-else-if="cart && cart.lines.length === 0" class="space-y-4">
      <p class="text-muted">Your cart is empty.</p>
      <UButton to="/products" label="Browse products" trailing-icon="i-lucide-arrow-right" />
    </div>

    <UForm v-else-if="cart" :schema="schema" :state="address" class="grid gap-10 lg:grid-cols-3" @submit="placeOrder">
      <div class="space-y-8 lg:col-span-2">
        <section class="space-y-4" aria-labelledby="shipping-heading">
          <h2 id="shipping-heading" class="text-xl font-semibold text-highlighted">Shipping address</h2>
          <UFormField label="Full name" name="name" required>
            <UInput v-model="address.name" autocomplete="name" class="w-full" />
          </UFormField>
          <UFormField label="Address" name="line1" required>
            <UInput v-model="address.line1" autocomplete="address-line1" class="w-full" />
          </UFormField>
          <UFormField label="Apartment, suite, etc." name="line2">
            <UInput v-model="address.line2" autocomplete="address-line2" class="w-full" />
          </UFormField>
          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="City" name="city" required>
              <UInput v-model="address.city" autocomplete="address-level2" class="w-full" />
            </UFormField>
            <UFormField label="State / region" name="region">
              <UInput v-model="address.region" autocomplete="address-level1" class="w-full" />
            </UFormField>
            <UFormField label="Postal code" name="postalCode" required>
              <UInput v-model="address.postalCode" autocomplete="postal-code" class="w-full" />
            </UFormField>
            <UFormField label="Country" name="country" required>
              <USelect v-model="address.country" :items="COUNTRIES" class="w-full" aria-label="Country" />
            </UFormField>
          </div>
        </section>

        <section class="space-y-4" aria-labelledby="payment-heading">
          <h2 id="payment-heading" class="text-xl font-semibold text-highlighted">Payment</h2>
          <PaymentStep ref="payment" :amount="cart.totals?.total ?? 0" :currency="cart.currency" />
        </section>
      </div>

      <aside class="space-y-4">
        <h2 class="font-semibold text-highlighted">Order summary</h2>
        <ul class="divide-y divide-default text-sm" aria-label="Order items">
          <li v-for="line in cart.lines" :key="line.sku" class="flex justify-between gap-2 py-2">
            <span>{{ line.quantity }} × {{ line.productName ?? line.variantName }} ({{ line.variantName }})</span>
            <span>{{ line.lineAmount === null ? '—' : money(line.lineAmount) }}</span>
          </li>
        </ul>
        <dl v-if="cart.totals" class="space-y-1 rounded-lg border border-default p-4" aria-label="Totals">
          <div class="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{{ money(cart.totals.subtotal) }}</dd>
          </div>
          <div v-if="cart.totals.discount > 0" class="flex justify-between text-success">
            <dt>Discount ({{ cart.couponCode }})</dt>
            <dd>−{{ money(cart.totals.discount) }}</dd>
          </div>
          <div class="flex justify-between border-t border-default pt-2 text-lg font-semibold text-highlighted">
            <dt>Total</dt>
            <dd>{{ money(cart.totals.total) }}</dd>
          </div>
        </dl>
        <UAlert
          v-if="cart.lockedByCheckoutId"
          color="info"
          variant="subtle"
          icon="i-lucide-lock"
          title="A checkout is already running for this cart."
          :actions="[{ label: 'View checkout', to: `/checkout/${cart.lockedByCheckoutId}` }]"
          data-test="cart-locked"
        />
        <UAlert
          v-else-if="!canCheckout"
          color="warning"
          variant="subtle"
          icon="i-lucide-circle-alert"
          title="Fix your cart before checking out."
          description="Remove unavailable items or coupons that do not apply."
          :actions="[{ label: 'Back to cart', to: '/cart' }]"
        />
        <UAlert v-if="placeError" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="placeError" />
        <UButton
          type="submit"
          block
          size="lg"
          label="Place order"
          icon="i-lucide-lock"
          :loading="placing"
          :disabled="!canCheckout"
        />
      </aside>
    </UForm>
  </UContainer>
</template>
