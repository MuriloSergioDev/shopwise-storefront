// The checkout saga end to end across the Tilt cluster: storefront BFF → cart, pricing, checkout → inventory,
// payments (fake gateway, no Stripe key), orders → notifications. Each test registers a fresh customer so carts,
// coupon redemptions and order history start empty.
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const INVENTORY_URL = process.env.E2E_INVENTORY_URL ?? 'http://localhost:8103'

/** Navigates and waits for hydration: a click on server-rendered HTML before Vue mounts does nothing. */
async function visit(page: Page, path: string) {
  await page.goto(path)
  await page.waitForFunction(
    () => !!(document.querySelector('#__nuxt') as { __vue_app__?: unknown } | null)?.__vue_app__,
  )
}

async function registerCustomer(page: Page) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@shopwise.test`
  const response = await page.request.post('/api/auth/register', {
    data: { name: 'E2E Shopper', email, password: 'correct-horse-battery' },
  })
  expect(response.status()).toBe(201)

  return email
}

async function available(request: APIRequestContext, sku: string): Promise<number> {
  const response = await request.get(`${INVENTORY_URL}/api/stock`, { params: { 'skus[]': sku } })
  const { data } = (await response.json()) as { data: Array<{ sku: string; available: number }> }

  return data.find((level) => level.sku === sku)!.available
}

/** Adds the product's default variant from its page and returns the SKU that landed in the cart. */
async function addToCart(page: Page, slug: string): Promise<string> {
  await visit(page, `/products/${slug}`)
  await page.getByRole('button', { name: 'Add to cart' }).click()
  await expect(page.getByText('Added to cart', { exact: true })).toBeVisible()
  const { data: cart } = await (await page.request.get('/api/cart')).json()

  return cart.lines[0].sku as string
}

async function fillShippingAddress(page: Page) {
  await page.getByLabel('Address', { exact: true }).fill('1 Analytical Way')
  await page.getByLabel('City').fill('Springfield')
  await page.getByLabel('Postal code').fill('12345')
}

test('browse, add to cart, apply a coupon, check out and find the order in the history', async ({ page }) => {
  await registerCustomer(page)

  await visit(page, '/products')
  await page
    .getByRole('link', { name: /Merino Crew Tee/ })
    .first()
    .click()
  await expect(page.getByRole('heading', { name: 'Merino Crew Tee' })).toBeVisible()
  const sku = await addToCart(page, 'merino-crew-tee')
  const before = await available(page.request, sku)

  await visit(page, '/cart')
  await page.getByLabel('Coupon code').fill('WELCOME10')
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(page.getByRole('definition').filter({ hasText: '−' })).toBeVisible()

  await page.getByRole('link', { name: 'Check out' }).click()
  await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible()
  await expect(page.getByText('Discount (WELCOME10)')).toBeVisible()
  await fillShippingAddress(page)
  await page.getByText('Visa ending 4242').click()
  await page.getByRole('button', { name: 'Place order' }).click()

  await expect(page.locator('[data-test="checkout-confirmed"]')).toBeVisible({ timeout: 60_000 })
  expect(await available(page.request, sku)).toBe(before - 1)

  await page.getByRole('link', { name: 'View your order' }).click()
  const heading = page.getByRole('heading', { name: /^Order SW-\d+$/ })
  await expect(heading).toBeVisible()
  const number = (await heading.textContent())!.replace('Order ', '')
  await expect(page.getByText('Discount (WELCOME10)')).toBeVisible()
  await expect(page.getByText('1 Analytical Way')).toBeVisible()

  await visit(page, '/orders')
  await expect(page.getByRole('link', { name: new RegExp(number) })).toBeVisible()

  // Checkout closed the cart: the customer starts over with an empty one.
  const { data: cart } = await (await page.request.get('/api/cart')).json()
  expect(cart.itemCount).toBe(0)
})

test('a declined card fails the checkout, releases the reservation and keeps the cart', async ({ page }) => {
  await registerCustomer(page)
  const sku = await addToCart(page, 'heavyweight-hoodie')
  const before = await available(page.request, sku)

  await visit(page, '/checkout')
  await fillShippingAddress(page)
  await page.getByText('Visa ending 0002').click()
  await page.getByRole('button', { name: 'Place order' }).click()

  await expect(page.locator('[data-test="failure-reason"]')).toHaveText(
    'Your card was declined. You have not been charged.',
    {
      timeout: 60_000,
    },
  )
  // Compensation done: the saga is final and the reserved unit is back.
  await expect(page.locator('[data-status="failed"]')).toBeVisible({ timeout: 60_000 })
  await expect.poll(() => available(page.request, sku)).toBe(before)

  const { data: cart } = await (await page.request.get('/api/cart')).json()
  expect(cart.lines).toEqual([expect.objectContaining({ sku, quantity: 1 })])

  await visit(page, '/orders')
  await expect(page.getByText('You have not ordered anything yet.')).toBeVisible()
})

/** Starts a checkout with the 3-D Secure test card and waits until it asks for the bank's confirmation. */
async function checkOutWith3ds(page: Page, slug: string) {
  await registerCustomer(page)
  const sku = await addToCart(page, slug)
  const before = await available(page.request, sku)

  await visit(page, '/checkout')
  await fillShippingAddress(page)
  await page.getByText('Visa ending 3220').click()
  await page.getByRole('button', { name: 'Place order' }).click()
  await expect(page.locator('[data-test="test-payment-action"]')).toBeVisible({ timeout: 60_000 })

  return { sku, before }
}

test('3-D Secure confirmed: the cart is locked while waiting, then the order is placed', async ({ page, context }) => {
  const { sku, before } = await checkOutWith3ds(page, 'linen-camp-shirt')

  // The checkout holds the cart: changes are refused and the cart page is read-only.
  const edit = await page.request.put(`/api/cart/items/${encodeURIComponent(sku)}`, { data: { quantity: 3 } })
  expect(edit.status()).toBe(409)
  expect((await edit.json()).data).toMatchObject({ code: 'cart_locked' })
  const cartPage = await context.newPage()
  await visit(cartPage, '/cart')
  await expect(cartPage.locator('[data-test="cart-locked"]')).toContainText('Your cart is being checked out.')
  await expect(cartPage.getByLabel('Coupon code')).toBeDisabled()
  await cartPage.close()

  await page.getByRole('button', { name: 'Complete 3-D Secure' }).click()
  await expect(page.locator('[data-test="checkout-confirmed"]')).toBeVisible({ timeout: 60_000 })
  expect(await available(page.request, sku)).toBe(before - 1)

  await visit(page, '/orders')
  await expect(page.getByRole('link', { name: /SW-\d+/ })).toBeVisible()
})

test('3-D Secure failed: authentication_required, stock released and the cart unlocked', async ({ page }) => {
  const { sku, before } = await checkOutWith3ds(page, 'cotton-chino-shorts')

  await page.getByRole('button', { name: 'Fail 3-D Secure' }).click()
  await expect(page.locator('[data-test="failure-reason"]')).toContainText(
    'We are unable to authenticate your payment method.',
    { timeout: 60_000 },
  )
  await expect(page.locator('[data-status="failed"]')).toBeVisible({ timeout: 60_000 })
  await expect.poll(() => available(page.request, sku)).toBe(before)

  // Checkout unlocked the cart when it failed: it can be changed again.
  const { data: cart } = await (await page.request.get('/api/cart')).json()
  expect(cart.lockedByCheckoutId).toBeNull()
  const edit = await page.request.put(`/api/cart/items/${encodeURIComponent(sku)}`, { data: { quantity: 2 } })
  expect(edit.status()).toBe(200)
})
