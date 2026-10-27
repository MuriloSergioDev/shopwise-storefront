import { describe, expect, it } from 'vitest'
import { parseTraceparent, startSpan, toOtlpSpan, traceparentOf } from '../../server/utils/tracing'

const incoming = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'

describe('tracing', () => {
  it('reads a W3C traceparent and ignores malformed or all-zero ones', () => {
    expect(parseTraceparent(incoming)).toEqual({
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      spanId: '00f067aa0ba902b7',
    })
    expect(parseTraceparent(undefined)).toBeNull()
    expect(parseTraceparent('garbage')).toBeNull()
    expect(parseTraceparent('00-00000000000000000000000000000000-00f067aa0ba902b7-01')).toBeNull()
  })

  it('continues the incoming trace with a new span, or starts a new trace', () => {
    const child = startSpan('GET /api/cart', 'server', parseTraceparent(incoming))
    expect(child.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736')
    expect(child.parentSpanId).toBe('00f067aa0ba902b7')
    expect(traceparentOf(child)).toMatch(/^00-4bf92f3577b34da6a3ce929d0e0e4736-[0-9a-f]{16}-01$/)

    const root = startSpan('GET /api/cart', 'server', null)
    expect(root.traceId).toMatch(/^[0-9a-f]{32}$/)
    expect(root.parentSpanId).toBeUndefined()
  })

  it('writes OTLP/JSON spans', () => {
    const span = startSpan('POST checkout', 'client', null, { 'http.response.status_code': 202, 'url.path': '/x' })

    expect(toOtlpSpan(span, span.startNs + 5n, false)).toMatchObject({
      kind: 3,
      startTimeUnixNano: span.startNs.toString(),
      endTimeUnixNano: (span.startNs + 5n).toString(),
      attributes: [
        { key: 'http.response.status_code', value: { intValue: 202 } },
        { key: 'url.path', value: { stringValue: '/x' } },
      ],
      status: { code: 1 },
    })
  })
})
