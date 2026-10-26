<script setup lang="ts">
useSeoMeta({ title: 'Cart · Shopwise' })

const { data: cart, error, status } = await useCart()
const { setQuantity, remove, applyCoupon, removeCoupon } = useCartActions()
const toast = useToast()

const busy = ref(false)
const couponInput = ref('')
const couponError = ref<string>()

const money = (amount: number | null) =>
  amount === null || !cart.value ? '—' : formatMoney(amount, cart.value.currency)

async function run(action: () => Promise<unknown>, fallback: string) {
  busy.value = true
  try {
    await action()
  } catch (failure) {
    toast.add({ title: errorMessageOf(failure, fallback), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    busy.value = false
  }
}

function changeQuantity(sku: string, quantity: number | null | undefined) {
  if (quantity && quantity >= 1) {
    return run(() => setQuantity(sku, quantity), 'The quantity could not be changed.')
  }
}

async function submitCoupon() {
  couponError.value = undefined
  const code = couponInput.value.trim()
  if (!code) {
    couponError.value = 'Enter a coupon code.'

    return
  }
  busy.value = true
  try {
    await applyCoupon(code)
    couponInput.value = ''
  } catch (failure) {
    couponError.value = errorMessageOf(failure, 'The coupon could not be applied.')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UContainer class="py-8">
    <h1 class="mb-6 text-3xl font-bold text-highlighted">Your cart</h1>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Your cart could not be loaded."
    />

    <p v-else-if="status === 'pending' && !cart" class="text-muted">Loading…</p>

    <div v-else-if="cart && cart.lines.length === 0" class="space-y-4">
      <p class="text-muted">Your cart is empty.</p>
      <UButton to="/products" label="Browse products" trailing-icon="i-lucide-arrow-right" />
    </div>

    <div v-else-if="cart" class="grid gap-10 lg:grid-cols-3">
      <ul class="divide-y divide-default lg:col-span-2" aria-label="Cart items">
        <li v-for="line in cart.lines" :key="line.sku" class="flex flex-wrap items-center gap-4 py-4">
          <div class="min-w-0 flex-1">
            <NuxtLink
              v-if="line.productSlug"
              :to="`/products/${line.productSlug}`"
              class="font-medium text-highlighted hover:text-primary"
            >
              {{ line.productName ?? line.variantName }}
            </NuxtLink>
            <p v-else class="font-medium text-highlighted">{{ line.productName ?? line.variantName }}</p>
            <p class="text-sm text-muted">{{ line.variantName }} · SKU {{ line.sku }}</p>
            <UBadge v-if="!line.available" color="warning" variant="subtle" label="No longer available" />
            <p v-else class="text-sm text-muted">{{ money(line.unitAmount) }} each</p>
          </div>

          <UInputNumber
            :model-value="line.quantity"
            :min="1"
            :max="99"
            :disabled="busy || !line.available"
            class="w-28"
            :aria-label="`Quantity of ${line.variantName}`"
            @update:model-value="(quantity) => changeQuantity(line.sku, quantity)"
          />

          <p class="w-24 text-right font-medium">{{ money(line.lineAmount) }}</p>

          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-trash-2"
            :aria-label="`Remove ${line.variantName}`"
            :disabled="busy"
            @click="run(() => remove(line.sku), 'The item could not be removed.')"
          />
        </li>
      </ul>

      <aside class="space-y-6">
        <div class="space-y-2">
          <h2 class="font-semibold text-highlighted">Coupon</h2>
          <div v-if="cart.couponCode" class="space-y-2">
            <div class="flex items-center gap-2">
              <UBadge :color="cart.coupon?.valid ? 'success' : 'warning'" variant="subtle" :label="cart.couponCode" />
              <UButton
                size="xs"
                color="neutral"
                variant="link"
                label="Remove"
                :disabled="busy"
                @click="run(removeCoupon, 'The coupon could not be removed.')"
              />
            </div>
            <p v-if="cart.coupon?.message" class="text-sm text-warning" data-test="coupon-message">
              {{ cart.coupon.message }}
            </p>
            <p v-else-if="cart.coupon?.description" class="text-sm text-muted">{{ cart.coupon.description }}</p>
          </div>
          <form v-else class="flex gap-2" @submit.prevent="submitCoupon">
            <UInput v-model="couponInput" placeholder="Coupon code" aria-label="Coupon code" class="flex-1" />
            <UButton type="submit" label="Apply" color="neutral" :loading="busy" />
          </form>
          <p v-if="couponError" class="text-sm text-error">{{ couponError }}</p>
        </div>

        <dl v-if="cart.totals" class="space-y-1 rounded-lg border border-default p-4" aria-label="Totals">
          <div class="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{{ money(cart.totals.subtotal) }}</dd>
          </div>
          <div v-if="cart.totals.discount > 0" class="flex justify-between text-success">
            <dt>Discount</dt>
            <dd>−{{ money(cart.totals.discount) }}</dd>
          </div>
          <div class="flex justify-between border-t border-default pt-2 text-lg font-semibold text-highlighted">
            <dt>Total</dt>
            <dd>{{ money(cart.totals.total) }}</dd>
          </div>
        </dl>
        <UAlert
          v-else
          color="warning"
          variant="subtle"
          icon="i-lucide-circle-alert"
          title="Totals are unavailable right now."
          description="Prices shown are the last known ones."
        />
        <p class="text-sm text-muted">Checkout is coming soon.</p>
      </aside>
    </div>
  </UContainer>
</template>
