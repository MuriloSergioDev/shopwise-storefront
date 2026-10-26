<script setup lang="ts">
const { data: cart } = useCart()
const count = computed(() => cart.value?.itemCount ?? 0)
</script>

<template>
  <UChip :text="count" :show="count > 0" size="3xl" inset>
    <UButton
      to="/cart"
      color="neutral"
      variant="ghost"
      icon="i-lucide-shopping-cart"
      :aria-label="count > 0 ? `Cart, ${count} items` : 'Cart'"
    />
  </UChip>
</template>
