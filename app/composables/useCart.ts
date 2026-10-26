import type { CartView } from '#shared/types/cart'

const CART_KEY = 'cart'

/** The shopper's cart (lines, totals, coupon verdict). Shared by the header badge and the cart page. */
export function useCart() {
  return useFetch('/api/cart', {
    key: CART_KEY,
    transform: (response) => response.data,
  })
}

/**
 * Cart changes. Each one returns the updated cart, which replaces the shared `useCart` data. Failures throw; their
 * message (errorMessageOf) is already worded for the shopper.
 */
export function useCartActions() {
  const { data } = useNuxtData<CartView>(CART_KEY)
  const { loggedIn, fetch: refreshSession } = useUserSession()

  async function apply(request: Promise<{ data: CartView }>) {
    const { data: cart } = await request
    data.value = cart
    // The BFF signs the customer out when their session can no longer be refreshed.
    if (loggedIn.value && cart.owner === 'guest') {
      await refreshSession()
    }

    return cart
  }

  const item = (sku: string) => `/api/cart/items/${encodeURIComponent(sku)}`

  return {
    add: (sku: string, quantity = 1) => apply($fetch('/api/cart/items', { method: 'POST', body: { sku, quantity } })),
    setQuantity: (sku: string, quantity: number) => apply($fetch(item(sku), { method: 'PUT', body: { quantity } })),
    remove: (sku: string) => apply($fetch(item(sku), { method: 'DELETE' })),
    applyCoupon: (code: string) => apply($fetch('/api/cart/coupon', { method: 'PUT', body: { code } })),
    removeCoupon: () => apply($fetch('/api/cart/coupon', { method: 'DELETE' })),
  }
}
