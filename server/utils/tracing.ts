import { randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import { ofetch } from 'ofetch'

// Just enough OpenTelemetry for the BFF to show up in Tempo: a server span per /api request and a client span per
// service call, exported as OTLP/JSON. Services continue the trace from the traceparent serviceFetch sends.
// Off when tracing.exporterUrl is empty (builds, tests); `nuxt dev` points it at the cluster's collector.

export interface Span {
  traceId: string
  spanId: string
  parentSpanId?: string
  name: string
  kind: 'server' | 'client'
  startNs: bigint
  attributes: Record<string, string | number>
}

const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/

/** The trace and parent span ids of a W3C traceparent header, or null when it is missing or malformed. */
export function parseTraceparent(header: string | undefined): { traceId: string; spanId: string } | null {
  const match = header ? TRACEPARENT.exec(header.trim()) : null
  if (!match || /^0+$/.test(match[1]!) || /^0+$/.test(match[2]!)) {
    return null
  }

  return { traceId: match[1]!, spanId: match[2]! }
}

export const traceparentOf = (span: Pick<Span, 'traceId' | 'spanId'>) => `00-${span.traceId}-${span.spanId}-01`

const nowNs = () => BigInt(Date.now()) * 1_000_000n

export function startSpan(
  name: string,
  kind: Span['kind'],
  parent: { traceId: string; spanId: string } | null,
  attributes: Span['attributes'] = {},
): Span {
  return {
    traceId: parent?.traceId ?? randomBytes(16).toString('hex'),
    spanId: randomBytes(8).toString('hex'),
    parentSpanId: parent?.spanId,
    name,
    kind,
    startNs: nowNs(),
    attributes,
  }
}

/** The span OTLP/JSON wants (ids in hex, times as strings of nanoseconds). */
export function toOtlpSpan(span: Span, endNs: bigint, error: boolean) {
  return {
    traceId: span.traceId,
    spanId: span.spanId,
    ...(span.parentSpanId ? { parentSpanId: span.parentSpanId } : {}),
    name: span.name,
    kind: span.kind === 'server' ? 2 : 3,
    startTimeUnixNano: span.startNs.toString(),
    endTimeUnixNano: endNs.toString(),
    attributes: Object.entries(span.attributes).map(([key, value]) => ({
      key,
      value: typeof value === 'number' ? { intValue: value } : { stringValue: value },
    })),
    status: { code: error ? 2 : 1 },
  }
}

/** Ends the span and sends it to the collector without waiting; a collector that is down only costs a log line. */
export function endSpan(event: H3Event, span: Span, error = false): void {
  const url = useRuntimeConfig(event).tracing.exporterUrl
  if (!url) {
    return
  }
  const body = {
    resourceSpans: [
      {
        resource: { attributes: [{ key: 'service.name', value: { stringValue: 'storefront-bff' } }] },
        scopeSpans: [{ scope: { name: 'shopwise-storefront' }, spans: [toOtlpSpan(span, nowNs(), error)] }],
      },
    ],
  }
  ofetch(`${url}/v1/traces`, { method: 'POST', body, timeout: 2000 }).catch((failure) =>
    console.debug('[tracing] export failed', failure),
  )
}

/** The request's server span (set by the tracing plugin for /api requests). */
export const requestSpan = (event: H3Event): Span | undefined => event.context.span as Span | undefined
