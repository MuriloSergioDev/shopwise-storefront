<script setup lang="ts">
definePageMeta({ middleware: 'customer' })
useSeoMeta({ title: 'Your order · Shopwise' })

const POLL_MS = 1000
// Payments answers within 5 minutes and every step re-sends for 90 s (ADR-0004); past that the shopper is told
// to check their orders rather than watch a spinner.
const GIVE_UP_MS = 6 * 60_000

const route = useRoute()
const id = computed(() => String(route.params.id))
const { data: checkout, error, refresh } = await useCheckoutStatus(id)

if (error.value?.statusCode === 404) {
  throw createError({ statusCode: 404, statusMessage: 'Checkout not found', fatal: true })
}

const placed = computed(() => !!checkout.value && isPlaced(checkout.value))
const failure = computed(() => (checkout.value ? failureMessage(checkout.value) : null))
const gaveUp = ref(false)

let timer: ReturnType<typeof setTimeout> | undefined
const startedAt = Date.now()

async function poll() {
  if (checkout.value && (isFinal(checkout.value) || isPlaced(checkout.value))) {
    return
  }
  if (Date.now() - startedAt > GIVE_UP_MS) {
    gaveUp.value = true

    return
  }
  timer = setTimeout(async () => {
    await refresh()
    await poll()
  }, POLL_MS)
}

// The cart is closed once the order exists: the header badge should show the new, empty one.
watch(placed, (now) => now && refreshNuxtData('cart'))

onMounted(poll)
onBeforeUnmount(() => clearTimeout(timer))

const money = (amount: number) => (checkout.value ? formatMoney(amount, checkout.value.currency) : '')
</script>

<template>
  <UContainer class="max-w-2xl py-12">
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="We could not load your checkout."
      :actions="[{ label: 'Try again', onClick: () => refresh() }]"
    />

    <div v-else-if="checkout" class="space-y-6" :data-status="checkout.status">
      <div v-if="placed" class="space-y-4" data-test="checkout-confirmed">
        <UIcon name="i-lucide-circle-check" class="size-12 text-success" />
        <h1 class="text-3xl font-bold text-highlighted">Thank you, your order is placed</h1>
        <p class="text-muted">We have emailed you a confirmation.</p>
        <UButton :to="`/orders/${checkout.orderId}`" label="View your order" trailing-icon="i-lucide-arrow-right" />
      </div>

      <div v-else-if="failure" class="space-y-4" data-test="checkout-failed">
        <UIcon name="i-lucide-circle-x" class="size-12 text-error" />
        <h1 class="text-3xl font-bold text-highlighted">Your order was not placed</h1>
        <p data-test="failure-reason">{{ failure }}</p>
        <p v-if="checkout.status === 'compensating'" class="text-sm text-muted">Releasing your items…</p>
        <div class="flex gap-2">
          <UButton to="/checkout" label="Try again" icon="i-lucide-rotate-ccw" />
          <UButton to="/cart" color="neutral" variant="outline" label="Back to cart" />
        </div>
      </div>

      <div v-else class="space-y-4" data-test="checkout-pending">
        <UIcon name="i-lucide-loader-circle" class="size-12 animate-spin text-primary" />
        <h1 class="text-3xl font-bold text-highlighted">{{ stepLabel(checkout.status) }}</h1>
        <p v-if="gaveUp" class="text-muted">
          This is taking longer than usual. Your order will show up in
          <ULink to="/orders" class="text-primary">your orders</ULink> once it is placed.
        </p>
        <p v-else class="text-muted">Keep this page open; it takes a few seconds.</p>
      </div>

      <dl class="space-y-1 rounded-lg border border-default p-4 text-sm" aria-label="Totals">
        <div v-for="line in checkout.lines" :key="line.sku" class="flex justify-between gap-2">
          <dt>{{ line.quantity }} × {{ line.productName ?? line.variantName }} ({{ line.variantName }})</dt>
          <dd>{{ money(line.lineAmount) }}</dd>
        </div>
        <div v-if="checkout.discount > 0" class="flex justify-between text-success">
          <dt>Discount ({{ checkout.couponCode }})</dt>
          <dd>−{{ money(checkout.discount) }}</dd>
        </div>
        <div class="flex justify-between border-t border-default pt-2 font-semibold text-highlighted">
          <dt>Total</dt>
          <dd>{{ money(checkout.total) }}</dd>
        </div>
      </dl>
    </div>
  </UContainer>
</template>
