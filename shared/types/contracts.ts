// View-model types shared by the app and the BFF, taken from the service contracts.
import type { CartApi, CatalogApi, IdentityApi, PricingApi } from '@shopwise/contracts'

type CatalogSchemas = CatalogApi.components['schemas']

export type Category = CatalogSchemas['Category']
export type ProductSummary = CatalogSchemas['ProductSummary']
export type Product = CatalogSchemas['Product']
export type Variant = CatalogSchemas['Variant']
export type Facets = CatalogSchemas['Facets']
export type ProductSearchResult =
  CatalogApi.operations['searchProducts']['responses'][200]['content']['application/json']

export type TokenPair = IdentityApi.components['schemas']['TokenPair']
export type Customer = IdentityApi.components['schemas']['Customer']

export type Cart = CartApi.components['schemas']['Cart']
export type CartLine = CartApi.components['schemas']['CartLine']

export type Price = PricingApi.components['schemas']['Price']
export type Quote = PricingApi.components['schemas']['Quote']
export type QuoteCoupon = NonNullable<Quote['coupon']>
export type CouponReason = NonNullable<QuoteCoupon['reason']>
