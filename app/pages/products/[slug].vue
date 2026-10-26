<script setup lang="ts">
const route = useRoute()
const slug = computed(() => String(route.params.slug))
const { data: product, error } = await useProduct(slug)

if (error.value?.statusCode === 404) {
  throw createError({ statusCode: 404, statusMessage: 'Product not found', fatal: true })
}

useSeoMeta({
  title: () => (product.value ? `${product.value.name} · Shopwise` : 'Shopwise'),
  description: () => product.value?.description,
})

const options = computed(() => optionValues(product.value?.variants ?? []))
const selected = ref<Record<string, string>>({ ...product.value?.variants[0]?.options })
const variant = computed(() => findVariant(product.value?.variants ?? [], selected.value))
const imageIndex = ref(0)
const image = computed(() => product.value?.images[imageIndex.value])
</script>

<template>
  <UContainer class="py-8">
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      icon="i-lucide-circle-alert"
      title="This product could not be loaded."
    />

    <div v-else-if="product" class="grid gap-10 md:grid-cols-2">
      <div>
        <div class="aspect-square overflow-hidden rounded-lg bg-elevated">
          <img v-if="image" :src="image.url" :alt="image.alt" class="size-full object-cover" />
        </div>
        <div v-if="product.images.length > 1" class="mt-3 flex gap-2">
          <button
            v-for="(thumbnail, index) in product.images"
            :key="thumbnail.url"
            type="button"
            class="size-16 overflow-hidden rounded border-2"
            :class="index === imageIndex ? 'border-primary' : 'border-transparent'"
            :aria-label="`Show image ${index + 1}`"
            @click="imageIndex = index"
          >
            <img :src="thumbnail.url" :alt="thumbnail.alt" class="size-full object-cover" />
          </button>
        </div>
      </div>

      <div class="space-y-6">
        <div>
          <NuxtLink
            :to="{ path: '/products', query: { category: product.category.slug } }"
            class="text-sm text-muted hover:text-primary"
          >
            {{ product.category.name }}
          </NuxtLink>
          <h1 class="text-3xl font-bold text-highlighted">{{ product.name }}</h1>
        </div>

        <p class="whitespace-pre-line">{{ product.description }}</p>

        <div v-for="(values, name) in options" :key="name">
          <h2 class="mb-2 text-sm font-semibold text-highlighted">{{ optionLabel(String(name)) }}</h2>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="value in values"
              :key="value"
              :label="value"
              :color="selected[name] === value ? 'primary' : 'neutral'"
              :variant="selected[name] === value ? 'solid' : 'outline'"
              @click="selected = { ...selected, [name]: value }"
            />
          </div>
        </div>

        <div class="rounded-lg border border-default p-4 text-sm">
          <template v-if="variant">
            <p class="font-medium text-highlighted">{{ variant.name }}</p>
            <p class="text-muted">SKU {{ variant.sku }}</p>
          </template>
          <p v-else class="text-muted">This combination is not available.</p>
          <p class="mt-2 text-muted">Prices and checkout are coming soon.</p>
        </div>
      </div>
    </div>
  </UContainer>
</template>
