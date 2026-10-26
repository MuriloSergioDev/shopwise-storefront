<script setup lang="ts">
import type { ProductSummary } from '#shared/types/contracts'

defineProps<{ product: ProductSummary }>()
</script>

<template>
  <NuxtLink
    :to="`/products/${product.slug}`"
    class="group block overflow-hidden rounded-lg border border-default bg-default transition hover:shadow-md"
  >
    <div class="aspect-square overflow-hidden bg-elevated">
      <img
        v-if="product.image"
        :src="product.image.url"
        :alt="product.image.alt"
        loading="lazy"
        class="size-full object-cover transition group-hover:scale-105"
      />
      <div v-else class="flex size-full items-center justify-center text-muted">
        <UIcon name="i-lucide-image-off" class="size-8" />
      </div>
    </div>
    <div class="p-3">
      <p class="text-xs text-muted">{{ product.category.name }}</p>
      <p class="font-medium text-highlighted">{{ product.name }}</p>
    </div>
  </NuxtLink>
</template>
