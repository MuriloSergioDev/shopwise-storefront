# shopwise-storefront

The Shopwise store: Nuxt app plus the Nitro BFF that is its only way into the services. Today it covers sign in,
registration, catalog browse/search, prices and the cart (coupons, guest cart merged on sign-in). Conventions:
`AGENTS.md`.

Run it from `shopwise-platform`: `tilt up -- --only=identity,catalog,pricing,cart,storefront`, seed the services once
(see the platform README), then open http://localhost:3000.

Checks: `pnpm check`.
