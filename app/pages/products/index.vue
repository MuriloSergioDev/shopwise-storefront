<script setup lang="ts">
import type { LocationQueryRaw } from 'vue-router'

const PER_PAGE = 12

const route = useRoute()
const query = computed(() => ({ perPage: PER_PAGE, ...route.query }))
const { data: result, status, error, refresh } = await useProductSearch(query)

const searchTerm = computed(() => (typeof route.query.q === 'string' ? route.query.q : ''))
const activeCategory = computed(() => route.query.category)
const page = computed(() => Number(route.query.page ?? 1))

useSeoMeta({ title: () => (searchTerm.value ? `“${searchTerm.value}” · Shopwise` : 'Products · Shopwise') })

/** Changes one filter and goes back to page 1; `undefined` removes it. */
function setFilter(key: string, value: string | undefined) {
  const next: LocationQueryRaw = { ...route.query, [key]: value }
  delete next.page
  return navigateTo({ query: next })
}

function toggleOption(name: string, value: string) {
  const key = `options[${name}]`
  return setFilter(key, route.query[key] === value ? undefined : value)
}

const hasFilters = computed(() => Object.keys(route.query).some((key) => key !== 'page'))
</script>

<template>
  <UContainer class="py-8">
    <UPageHeader
      :title="searchTerm ? `Results for “${searchTerm}”` : 'All products'"
      :description="result ? `${result.meta.total} ${result.meta.total === 1 ? 'product' : 'products'}` : undefined"
    />

    <div class="mt-8 grid gap-8 lg:grid-cols-[14rem_1fr]">
      <aside v-if="result" class="space-y-6" aria-label="Filters">
        <div>
          <h3 class="mb-2 text-sm font-semibold text-highlighted">Category</h3>
          <ul class="space-y-1 text-sm">
            <li>
              <button
                type="button"
                class="hover:text-primary"
                :class="!activeCategory && 'font-semibold text-primary'"
                @click="setFilter('category', undefined)"
              >
                All
              </button>
            </li>
            <li v-for="facet in result.facets.categories" :key="facet.slug">
              <button
                type="button"
                class="hover:text-primary"
                :class="activeCategory === facet.slug && 'font-semibold text-primary'"
                @click="setFilter('category', facet.slug)"
              >
                {{ facet.name }} <span class="text-muted">({{ facet.count }})</span>
              </button>
            </li>
          </ul>
        </div>

        <div v-for="option in result.facets.options" :key="option.name">
          <h3 class="mb-2 text-sm font-semibold text-highlighted">{{ optionLabel(option.name) }}</h3>
          <div class="flex flex-wrap gap-1.5">
            <UButton
              v-for="facet in option.values"
              :key="facet.value"
              size="xs"
              :color="route.query[`options[${option.name}]`] === facet.value ? 'primary' : 'neutral'"
              :variant="route.query[`options[${option.name}]`] === facet.value ? 'solid' : 'outline'"
              :label="`${facet.value} (${facet.count})`"
              @click="toggleOption(option.name, facet.value)"
            />
          </div>
        </div>

        <UButton
          v-if="hasFilters"
          to="/products"
          color="neutral"
          variant="link"
          icon="i-lucide-x"
          label="Clear all"
          class="px-0"
        />
      </aside>

      <section>
        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          title="Products could not be loaded."
          :actions="[{ label: 'Try again', onClick: () => refresh() }]"
        />
        <template v-else-if="result">
          <UEmpty
            v-if="result.data.length === 0"
            icon="i-lucide-search-x"
            title="No products match"
            description="Try another search or clear a filter."
          />
          <ProductGrid v-else :products="result.data" />
          <div v-if="result.meta.lastPage > 1" class="mt-8 flex justify-center">
            <UPagination
              :page="page"
              :total="result.meta.total"
              :items-per-page="result.meta.perPage"
              :to="(target: number) => ({ query: { ...route.query, page: target } })"
            />
          </div>
        </template>
        <p v-else-if="status === 'pending'" class="text-muted">Loading…</p>
      </section>
    </div>
  </UContainer>
</template>
