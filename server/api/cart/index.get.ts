export default defineEventHandler(async (event) => {
  const cart = await asShopper(event, (token) => findCart(event, token))

  return { data: await toCartView(event, cart) }
})
