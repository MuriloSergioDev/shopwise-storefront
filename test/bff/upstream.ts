import { createServer, type IncomingHttpHeaders } from 'node:http'
import type { AddressInfo } from 'node:net'

export interface UpstreamCall {
  method: string
  path: string
  query: URLSearchParams
  headers: IncomingHttpHeaders
  body: Record<string, unknown> | undefined
}

export interface UpstreamReply {
  status: number
  body?: unknown
}

/**
 * A fake identity + catalog on one port. Every call is recorded; `reply` decides the response. The BFF under test
 * is pointed at it through NUXT_IDENTITY_URL / NUXT_CATALOG_URL.
 */
export async function startUpstream(reply: (call: UpstreamCall) => UpstreamReply) {
  const calls: UpstreamCall[] = []
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = []
    for await (const chunk of req) {
      chunks.push(chunk as Buffer)
    }
    const raw = Buffer.concat(chunks).toString()
    const url = new URL(req.url ?? '/', 'http://upstream')
    const call: UpstreamCall = {
      method: req.method ?? 'GET',
      path: url.pathname,
      query: url.searchParams,
      headers: req.headers,
      body: raw ? JSON.parse(raw) : undefined,
    }
    calls.push(call)

    const { status, body } = reply(call)
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(body === undefined ? '' : JSON.stringify(body))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    calls,
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}
