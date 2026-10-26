// The cart as the BFF returns it: cart service lines composed with a pricing quote. The cart id is left out on
// purpose (a guest cart is reachable by its id alone).
import type { CouponReason } from './contracts'

export interface CartViewLine {
  sku: string
  quantity: number
  productSlug: string | null
  productName: string | null
  variantName: string
  /** False once the variant is inactive or its product unpublished; such lines are not priced. */
  available: boolean
  /** Minor units. From the quote, or the cart's last known price when pricing is unavailable. */
  unitAmount: number | null
  lineAmount: number | null
}

export interface CartViewCoupon {
  code: string
  valid: boolean
  reason: CouponReason | null
  /** Why the coupon does not apply, worded for the shopper; null when valid. */
  message: string | null
  description: string | null
}

export interface CartView {
  owner: 'guest' | 'customer'
  /** Sum of quantities, for the header badge. */
  itemCount: number
  currency: string
  lines: CartViewLine[]
  couponCode: string | null
  /** The quote's verdict on couponCode; null when there is no code or nothing to price. */
  coupon: CartViewCoupon | null
  /** Null when pricing could not be reached. */
  totals: { subtotal: number; discount: number; total: number } | null
}
