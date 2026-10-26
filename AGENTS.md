# shopwise-storefront

The shopper-facing Nuxt app and its Nitro BFF. The BFF is the only public entry: the browser calls `/api/*` here,
the BFF calls services. Service URLs and JWTs never reach the browser.

## Stack

Nuxt 4 (`app/`, `server/`, `shared/`), Nuxt UI 4 (Tailwind 4), `nuxt-auth-utils` for the session, `zod` for
validation, strict TypeScript. Contract types come from `@shopwise/contracts` (pnpm git dependency) via
`shared/types/contracts.ts`; never hand-write a service's response type.

## Layout

- `server/api/<area>/…` — BFF routes. Validate input with zod (`readValidatedBody`, `getValidatedQuery`,
  `getValidatedRouterParams`), call services only through `serviceFetch`, return contract shapes.
- `server/utils/services.ts` — `serviceFetch(event, service, path, options)`: base URL from runtime config,
  `Bearer` token when given, forwards `traceparent`, maps failures through `toBffError` (4xx pass through with the
  service's message; anything else is a 502 that hides service internals). `startSession` seals a token pair and
  merges the guest cart.
- `server/utils/customer-session.ts` — `customerTokens` (refreshing), `asShopper` (run a call with the customer's
  token, refresh + retry once on 401). `server/middleware/refresh-session.ts` refreshes on every request.
- `server/utils/cart.ts`, `cart-view.ts` — find/open/update the shopper's cart; compose it with a pricing quote.
- `app/composables/` — one `useFetch` wrapper per BFF route with a stable key. Pages `await` them.
- `app/pages/` — `index`, `products/index` (search, facets, pagination; all state lives in the URL query),
  `products/[slug]` (price + add to cart), `cart`, `login`, `register` (guest-only middleware).

BFF routes: `POST /api/auth/{login,register,logout}`, `GET /api/catalog/categories`, `GET /api/catalog/products`,
`GET /api/catalog/products/{slug}`, `GET /api/pricing/prices?skus[]=`, `GET /api/cart`, `POST /api/cart/items`
(`{sku, quantity?}`, adds to what is there), `PUT|DELETE /api/cart/items/{sku}` (`{quantity}` sets it),
`PUT|DELETE /api/cart/coupon` (`{code}`). Every cart route returns the `CartView` (`shared/types/cart.ts`).

## Rules

- **Session**: `user` (id, email, name, roles) is visible to the browser; tokens live in `secure`, which never
  leaves the server. Shapes in `shared/types/auth.d.ts`. Sign out through `POST /api/auth/logout` (revokes the
  refresh token), not nuxt-auth-utils' `DELETE /api/_auth/session`.
- **Refresh tokens rotate and reuse revokes the whole family.** All parallel requests of one customer carry the
  same sealed cookie, so they hold the same refresh token. How the BFF stays safe:
  - Refresh happens when the access token has under 30 s left, or once after a service answers 401 (`asShopper`).
  - `refresh-coordinator.ts` keys exchanges by refresh token: the first caller exchanges it, concurrent callers
    await the same promise, and the result is kept for a 30 s grace window so requests that still arrive with
    the old cookie get the new pair instead of reusing the spent token. Identity 401s are kept too; network/5xx
    failures are forgotten so the next request can retry.
  - SSR: `useFetch` during a page render calls the BFF internally, and Set-Cookie from those internal responses is
    dropped. So `server/middleware/refresh-session.ts` refreshes on every request with a session cookie (pages
    included): the page response carries the new cookie, and the internal calls (sent with the old cookie) get the
    same pair from the coordinator.
  - Identity rejects the refresh token → `endCustomerSession`: the customer becomes a guest (an unmerged guest
    cart id survives). Identity unreachable → the route fails with 502 and the session is kept.
  - The coordinator is in-process memory. With more than one BFF replica it needs a shared lock (e.g. Redis).
- **h3 sessions within one request**: `clearUserSession` makes the next read in the same request unseal the
  request's cookie again, and `replaceUserSession` merges top-level keys into that cookie's data. To drop a key,
  write it as `undefined` (see `endCustomerSession`), and don't read the session after clearing it.
- **Cart**: the guest cart id lives in `secure.guestCartId` (a guest cart is reachable by its id alone, so the id
  never reaches the browser, including in `CartView`). It is created on the first add. Sign-in and registration
  merge it into the customer cart; a failed merge is logged, the id is kept and every cart request retries it.
  Customers always go through `GET /api/me/cart` with their bearer token. Cart totals come from pricing
  (`POST /api/quotes`, available lines only); if pricing fails the cart still renders with `totals: null`.
- **Caching**: SSR pages are never cached (they render the signed-in user and their cart). Only public catalog
  reads have `routeRules` cache entries; cart and price routes never get one. Cached handlers drop request
  headers (including `traceparent` and the session cookie), and the search endpoint must stay uncached: keep
  cache patterns one segment deep (`/api/catalog/products/*`, not `/**`).
- Money is integer minor units plus a currency; format it with `formatMoney` (`shared/utils/money.ts`).

## Run

Under Tilt from `shopwise-platform`: `tilt up -- --only=identity,catalog,pricing,cart,storefront` →
http://localhost:3000. Alone: `pnpm dev` (needs identity :8101, catalog :8102, pricing :8104, cart :8105; override
with `NUXT_IDENTITY_URL` / `NUXT_CATALOG_URL` / `NUXT_PRICING_URL` / `NUXT_CART_URL`). Demo accounts come from
identity's seeder.

## Checks

`pnpm check` = prettier, eslint, `nuxt typecheck`, vitest. Vitest projects:

- `test/unit` — plain Node, pure helpers.
- `test/nuxt` — Nuxt environment, components and pages (`mountSuspended`, `registerEndpoint`).
- `test/bff` — builds the app and calls the real Nitro server against in-memory fakes of identity, catalog,
  pricing and cart (`test/bff/fake-services.ts` on `upstream.ts`). Every BFF route gets a test here, and so does
  the refresh behaviour (401 retry, concurrent and late requests, SSR page requests, rejected refresh).

Install note: `pnpm-workspace.yaml` allowlists build scripts; `@shopwise/contracts` is set to `false` so pnpm doesn't
run its `prepare` (lefthook) when installing it from git.
