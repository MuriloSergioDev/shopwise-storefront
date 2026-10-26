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

const skus = computed(() => (product.value?.variants ?? []).map((candidate) => candidate.sku))
const { data: prices } = await usePrices(skus)
const price = computed(() => (variant.value ? prices.value[variant.value.sku] : undefined))

const { add } = useCartActions()
const toast = useToast()
const adding = ref(false)

async function addToCart() {
  if (!variant.value) {
    return
  }
  adding.value = true
  try {
    await add(variant.value.sku)
    toast.add({
      title: 'Added to cart',
      description: variant.value.name,
      icon: 'i-lucide-shopping-cart',
      actions: [{ label: 'View cart', to: '/cart' }],
    })
  } catch (failure) {
    toast.add({ title: errorMessageOf(failure, 'This item could not be added.'), color: 'error' })
  } finally {
    adding.value = false
  }
}
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

        <div class="space-y-3 rounded-lg border border-default p-4">
          <template v-if="variant">
            <p class="text-2xl font-semibold text-highlighted" data-test="price">
              {{ price ? formatMoney(price.amount, price.currency) : 'Price unavailable' }}
            </p>
            <p class="text-sm font-medium text-highlighted">{{ variant.name }}</p>
            <p class="text-sm text-muted">SKU {{ variant.sku }}</p>
            <UButton
              v-if="variant.active"
              label="Add to cart"
              icon="i-lucide-shopping-cart"
              size="lg"
              block
              :loading="adding"
              :disabled="!price"
              @click="addToCart"
            />
            <p v-else class="text-sm text-muted">This option is no longer available.</p>
          </template>
          <p v-else class="text-sm text-muted">This combination is not available.</p>
        </div>
      </div>
    </div>
  </UContainer>
</template>
