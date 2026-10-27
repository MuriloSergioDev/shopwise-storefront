<script setup lang="ts">
definePageMeta({ middleware: 'customer' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const { data: order, error } = await useOrder(id)

if (error.value?.statusCode === 404) {
  throw createError({ statusCode: 404, statusMessage: 'Order not found', fatal: true })
}

useSeoMeta({ title: () => (order.value ? `Order ${order.value.number} · Shopwise` : 'Order · Shopwise') })

const money = (amount: number) => (order.value ? formatMoney(amount, order.value.currency) : '')
const dateOf = (iso: string) => new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
</script>

<template>
  <UContainer class="py-8">
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="This order could not be loaded."
    />

    <div v-else-if="order" class="space-y-8">
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-3xl font-bold text-highlighted">Order {{ order.number }}</h1>
        <UBadge :color="order.status === 'shipped' ? 'success' : 'neutral'" variant="subtle" :label="order.status" />
      </div>
      <p class="text-muted">Placed {{ dateOf(order.placedAt) }}</p>

      <div class="grid gap-10 lg:grid-cols-3">
        <div class="lg:col-span-2">
          <ul class="divide-y divide-default" aria-label="Order items">
            <li v-for="line in order.lines" :key="line.sku" class="flex flex-wrap items-center gap-4 py-3">
              <div class="min-w-0 flex-1">
                <p class="font-medium text-highlighted">{{ line.productName ?? line.variantName }}</p>
                <p class="text-sm text-muted">{{ line.variantName }} · SKU {{ line.sku }}</p>
              </div>
              <p class="text-sm text-muted">{{ line.quantity }} × {{ money(line.unitAmount) }}</p>
              <p class="w-24 text-right font-medium">{{ money(line.lineAmount) }}</p>
            </li>
          </ul>
        </div>

        <aside class="space-y-6">
          <dl class="space-y-1 rounded-lg border border-default p-4" aria-label="Totals">
            <div class="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{{ money(order.subtotal) }}</dd>
            </div>
            <div v-if="order.discount > 0" class="flex justify-between text-success">
              <dt>Discount ({{ order.couponCode }})</dt>
              <dd>−{{ money(order.discount) }}</dd>
            </div>
            <div class="flex justify-between border-t border-default pt-2 text-lg font-semibold text-highlighted">
              <dt>Total</dt>
              <dd>{{ money(order.total) }}</dd>
            </div>
          </dl>

          <div>
            <h2 class="mb-1 font-semibold text-highlighted">Ships to</h2>
            <address class="text-sm not-italic">
              {{ order.shippingAddress.name }}<br />
              {{ order.shippingAddress.line1 }}<br />
              <template v-if="order.shippingAddress.line2">{{ order.shippingAddress.line2 }}<br /></template>
              {{ order.shippingAddress.city
              }}<template v-if="order.shippingAddress.region">, {{ order.shippingAddress.region }}</template>
              {{ order.shippingAddress.postalCode }}<br />
              {{ order.shippingAddress.country }}
            </address>
          </div>

          <div v-if="order.shipment">
            <h2 class="mb-1 font-semibold text-highlighted">Shipment</h2>
            <p class="text-sm">{{ order.shipment.carrier }} · {{ order.shipment.trackingNumber }}</p>
            <p class="text-sm text-muted">Shipped {{ dateOf(order.shipment.shippedAt) }}</p>
          </div>
        </aside>
      </div>

      <UButton to="/orders" color="neutral" variant="link" icon="i-lucide-arrow-left" label="All orders" />
    </div>
  </UContainer>
</template>
