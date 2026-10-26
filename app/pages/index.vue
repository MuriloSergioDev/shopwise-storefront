<script setup lang="ts">
useSeoMeta({ title: 'Shopwise', description: 'Everyday apparel and kitchen goods.' })

const [{ data: categories }, { data: latest, status, error }] = await Promise.all([
  useCategories(),
  useProductSearch({ perPage: 8 }),
])

const topLevel = computed(() => categories.value.filter((category) => category.parentId === null))
const childrenOf = (id: string) => categories.value.filter((category) => category.parentId === id)
</script>

<template>
  <UContainer>
    <UPageHero
      title="Good things for every day"
      description="Apparel and kitchen goods, picked for how long they last."
      :links="[{ label: 'Browse products', to: '/products', trailingIcon: 'i-lucide-arrow-right' }]"
    />

    <section v-if="topLevel.length" class="mb-12 grid gap-4 sm:grid-cols-2">
      <UCard v-for="category in topLevel" :key="category.id">
        <NuxtLink :to="{ path: '/products', query: { category: category.slug } }" class="text-lg font-semibold">
          {{ category.name }}
        </NuxtLink>
        <div class="mt-2 flex flex-wrap gap-2">
          <UButton
            v-for="child in childrenOf(category.id)"
            :key="child.id"
            :to="{ path: '/products', query: { category: child.slug } }"
            :label="child.name"
            color="neutral"
            variant="subtle"
            size="sm"
          />
        </div>
      </UCard>
    </section>

    <section class="mb-16">
      <h2 class="mb-4 text-2xl font-semibold text-highlighted">New arrivals</h2>
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-circle-alert"
        title="Products could not be loaded."
      />
      <ProductGrid v-else-if="latest" :products="latest.data" />
      <p v-else-if="status === 'pending'" class="text-muted">Loading…</p>
    </section>
  </UContainer>
</template>
