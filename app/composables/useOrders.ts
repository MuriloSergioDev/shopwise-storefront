/** The customer's order history, one page at a time. */
export function useOrders(page: MaybeRefOrGetter<number>) {
  return useFetch('/api/orders', {
    key: () => `orders-${toValue(page)}`,
    query: computed(() => ({ page: toValue(page) })),
  })
}

export function useOrder(id: MaybeRefOrGetter<string>) {
  return useFetch(() => `/api/orders/${toValue(id)}`, {
    key: () => `order-${toValue(id)}`,
    transform: (response) => response.data,
  })
}
