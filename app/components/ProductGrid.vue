<script setup lang="ts">
import type { ProductSummary } from '#shared/types/contracts'

defineProps<{ products: ProductSummary[] }>()
</script>

<template>
  <div class="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
    <ProductCard v-for="product in products" :key="product.id" :product="product" />
  </div>
</template>
