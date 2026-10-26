<script setup lang="ts">
const route = useRoute()
const term = ref(typeof route.query.q === 'string' ? route.query.q : '')

watch(
  () => route.query.q,
  (q) => (term.value = typeof q === 'string' ? q : ''),
)

function search() {
  const q = term.value.trim()
  return navigateTo({ path: '/products', query: q ? { q } : {} })
}
</script>

<template>
  <form role="search" @submit.prevent="search">
    <UInput v-model="term" icon="i-lucide-search" placeholder="Search products" aria-label="Search products" />
  </form>
</template>
