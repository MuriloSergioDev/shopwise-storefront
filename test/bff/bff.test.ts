// Builds the app and runs the real Nitro server against a fake identity + catalog.
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { fetch, setup } from '@nuxt/test-utils/e2e'
import { startUpstream, type UpstreamCall, type UpstreamReply } from './upstream'

const PASSWORD = 'correct-horse-battery'
const pair = (n: number) => ({
  tokenType: 'Bearer',
  accessToken: `access-${n}`,
  expiresIn: 900,
  refreshToken: `refresh-${n}`,
  refreshExpiresIn: 2_592_000,
})
const customer = {
  id: '01customer',
  email: 'ada@shopwise.test',
  name: 'Ada',
  roles: ['customer'],
  registeredAt: '2026-10-26T00:00:00Z',
}
const searchResult = {
  data: [],
  meta: { page: 1, perPage: 24, total: 0, lastPage: 1 },
  facets: { categories: [], options: [] },
}

function reply(call: UpstreamCall): UpstreamReply {
  switch (`${call.method} ${call.path}`) {
    case 'POST /api/tokens':
      return call.body?.password === PASSWORD
        ? { status: 200, body: { data: pair(1) } }
        : { status: 422, body: { message: 'These credentials do not match our records.' } }
    case 'POST /api/customers':
      return { status: 201, body: { data: pair(2) } }
    case 'GET /api/me':
      return call.headers.authorization?.startsWith('Bearer access-')
        ? { status: 200, body: { data: customer } }
        : { status: 401 }
    case 'POST /api/tokens/revoke':
      return { status: 204 }
    case 'GET /api/products':
      return { status: 200, body: searchResult }
    case 'GET /api/products/missing':
      return { status: 404, body: { message: 'Not found.' } }
    default:
      return { status: 500, body: { message: 'SQLSTATE[42P01]: relation "products" does not exist' } }
  }
}

const upstream = await startUpstream(reply)
process.env.NUXT_IDENTITY_URL = upstream.url
process.env.NUXT_CATALOG_URL = upstream.url
process.env.NUXT_SESSION_PASSWORD = 'test-session-password-at-least-32-chars'

await setup({ server: true, browser: false })

afterAll(() => upstream.close())
beforeEach(() => {
  upstream.calls.length = 0
})

function post(path: string, body?: unknown, cookie?: string) {
  return fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

function sessionCookie(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ')
}

async function session(cookie: string) {
  return (await fetch('/api/_auth/session', { headers: { cookie } })).json()
}

describe('auth', () => {
  it('signs in: exchanges credentials, loads the customer and keeps tokens out of the browser', async () => {
    const response = await post('/api/auth/login', { email: customer.email, password: PASSWORD })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: customer })
    const me = upstream.calls.find((call) => call.path === '/api/me')
    expect(me?.headers.authorization).toBe('Bearer access-1')

    const current = await session(sessionCookie(response))
    expect(current.user).toEqual({ id: customer.id, email: customer.email, name: 'Ada', roles: ['customer'] })
    expect(JSON.stringify(current)).not.toContain('access-1')
    expect(JSON.stringify(current)).not.toContain('refresh-1')
  })

  it("passes identity's message through when credentials are wrong", async () => {
    const response = await post('/api/auth/login', { email: customer.email, password: 'wrong-password' })

    expect(response.status).toBe(422)
    expect((await response.json()).statusMessage).toBe('These credentials do not match our records.')
  })

  it('rejects a malformed body without calling identity', async () => {
    const response = await post('/api/auth/login', { email: 'not-an-email' })

    expect(response.status).toBe(400)
    expect(upstream.calls).toHaveLength(0)
  })

  it('registers and signs the new customer in', async () => {
    const response = await post('/api/auth/register', { name: 'Ada', email: customer.email, password: PASSWORD })

    expect(response.status).toBe(201)
    expect(upstream.calls.find((call) => call.path === '/api/customers')?.body).toEqual({
      name: 'Ada',
      email: customer.email,
      password: PASSWORD,
    })
    expect((await session(sessionCookie(response))).user?.email).toBe(customer.email)
  })

  it('signs out: revokes the refresh token and clears the session', async () => {
    const login = await post('/api/auth/login', { email: customer.email, password: PASSWORD })
    const cookie = sessionCookie(login)

    const response = await post('/api/auth/logout', undefined, cookie)

    expect(response.status).toBe(204)
    expect(upstream.calls.find((call) => call.path === '/api/tokens/revoke')?.body).toEqual({
      refreshToken: 'refresh-1',
    })
    expect((await session(sessionCookie(response) || cookie)).user).toBeUndefined()
  })
})

describe('catalog', () => {
  it('forwards search filters and drops unknown ones', async () => {
    const response = await fetch('/api/catalog/products?q=tee&options[color]=Black&page=2&sort=price', {
      headers: { traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01' },
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(searchResult)
    const call = upstream.calls[0]!
    expect(Object.fromEntries(call.query)).toEqual({ q: 'tee', 'options[color]': 'Black', page: '2' })
    expect(call.headers.traceparent).toBe('00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01')
  })

  it('rejects invalid paging without calling catalog', async () => {
    const response = await fetch('/api/catalog/products?perPage=500')

    expect(response.status).toBe(400)
    expect(upstream.calls).toHaveLength(0)
  })

  it('passes a missing product through as 404', async () => {
    expect((await fetch('/api/catalog/products/missing')).status).toBe(404)
  })

  it('turns a catalog failure into a 502 without leaking its message', async () => {
    const response = await fetch('/api/catalog/products/broken')
    const body = await response.text()

    expect(response.status).toBe(502)
    expect(body).toContain('The catalog service is unavailable.')
    expect(body).not.toContain('SQLSTATE')
  })
})
