import type { LocationQuery } from 'vue-router'

export function useCategories() {
  return useFetch('/api/catalog/categories', {
    key: 'catalog-categories',
    transform: (response) => response.data,
    default: () => [],
  })
}

/** Products matching the current search; refetches whenever `query` changes (it is usually `route.query`). */
export function useProductSearch(query: MaybeRefOrGetter<LocationQuery | Record<string, string | number>>) {
  return useFetch('/api/catalog/products', {
    key: 'catalog-product-search',
    query: computed(() => toValue(query)),
  })
}

export function useProduct(slug: MaybeRefOrGetter<string>) {
  return useFetch(() => `/api/catalog/products/${toValue(slug)}`, {
    key: () => `catalog-product-${toValue(slug)}`,
    transform: (response) => response.data,
  })
}
