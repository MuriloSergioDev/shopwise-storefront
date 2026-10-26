// View-model types shared by the app and the BFF, taken from the service contracts.
import type { CatalogApi, IdentityApi } from '@shopwise/contracts'

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
