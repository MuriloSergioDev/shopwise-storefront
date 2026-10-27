// A server span per BFF API request; see server/utils/tracing.ts.
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    if (!event.path.startsWith('/api/') || event.path.startsWith('/api/_')) {
      return
    }
    const route = event.path.split('?')[0]!
    event.context.span = startSpan(
      `${event.method} ${route}`,
      'server',
      parseTraceparent(getRequestHeader(event, 'traceparent')),
      { 'http.request.method': event.method, 'url.path': route },
    )
  })

  nitroApp.hooks.hook('afterResponse', (event) => {
    const span = requestSpan(event)
    if (!span) {
      return
    }
    const status = getResponseStatus(event)
    span.attributes['http.response.status_code'] = status
    endSpan(event, span, status >= 500)
  })
})
