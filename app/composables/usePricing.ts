import type { Price } from '#shared/types/contracts'

/** Current prices for the given SKUs, keyed by SKU. SKUs without a price are missing from the map. */
export function usePrices(skus: MaybeRefOrGetter<string[]>) {
  const list = computed(() => [...toValue(skus)].sort())

  return useFetch('/api/pricing/prices', {
    key: () => `pricing-prices-${list.value.join(',')}`,
    query: computed(() => ({ 'skus[]': list.value })),
    immediate: list.value.length > 0,
    transform: (response) => Object.fromEntries(response.data.map((price) => [price.sku, price])),
    default: (): Record<string, Price> => ({}),
  })
}
