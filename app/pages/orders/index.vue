<script setup lang="ts">
definePageMeta({ middleware: 'customer' })
useSeoMeta({ title: 'Your orders · Shopwise' })

const route = useRoute()
const page = computed(() => Math.max(1, Number(route.query.page) || 1))
const { data: orders, error } = await useOrders(page)

const dateOf = (iso: string) => new Date(iso).toLocaleDateString('en-US', { dateStyle: 'medium' })
</script>

<template>
  <UContainer class="py-8">
    <h1 class="mb-6 text-3xl font-bold text-highlighted">Your orders</h1>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="Your orders could not be loaded."
    />

    <div v-else-if="orders && orders.data.length === 0" class="space-y-4">
      <p class="text-muted">You have not ordered anything yet.</p>
      <UButton to="/products" label="Browse products" trailing-icon="i-lucide-arrow-right" />
    </div>

    <div v-else-if="orders" class="space-y-6">
      <ul class="divide-y divide-default" aria-label="Orders">
        <li v-for="order in orders.data" :key="order.id">
          <NuxtLink :to="`/orders/${order.id}`" class="flex flex-wrap items-center gap-4 py-4 hover:bg-elevated/50">
            <span class="font-medium text-highlighted">{{ order.number }}</span>
            <span class="text-sm text-muted">{{ dateOf(order.placedAt) }}</span>
            <span class="text-sm text-muted">{{ order.itemCount }} {{ order.itemCount === 1 ? 'item' : 'items' }}</span>
            <UBadge
              :color="order.status === 'shipped' ? 'success' : 'neutral'"
              variant="subtle"
              :label="order.status"
            />
            <span class="ml-auto font-medium">{{ formatMoney(order.total, order.currency) }}</span>
          </NuxtLink>
        </li>
      </ul>
      <UPagination
        v-if="orders.meta.lastPage > 1"
        :page="orders.meta.page"
        :total="orders.meta.total"
        :items-per-page="orders.meta.perPage"
        :to="(target: number) => ({ query: { page: target } })"
      />
    </div>
  </UContainer>
</template>
