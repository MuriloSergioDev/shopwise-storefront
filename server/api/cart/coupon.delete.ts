export default defineEventHandler(async (event) => {
  const cart = await updateCart(event, cartRequest(event, '/coupon', 'DELETE'))

  return { data: await toCartView(event, cart) }
})
