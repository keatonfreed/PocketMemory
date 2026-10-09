export async function readEventStream(response, onEvent) {
  if (!response.body) throw new Error('The response connection is unavailable. Please retry.')
  const reader = response.body.getReader(), decoder = new TextDecoder()
  let buffer = '', result
  function frame(value) {
    const data = value.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
    if (!data) return
    const event = JSON.parse(data)
    if (event.type === 'error') throw Object.assign(new Error(event.error), { status: event.status, code: event.code, conflict: event.conflict, requestId: event.requestId, stage: event.stage, diagnostics: event.diagnostics })
    if (event.type === 'complete') result = { entry: event.entry }
    onEvent?.(event)
  }
  try {
    let ended = false
    while (!ended) {
      const { value, done } = await reader.read()
      buffer = (buffer + decoder.decode(value, { stream: !done })).replace(/\r\n/g, '\n')
      let end
      while ((end = buffer.indexOf('\n\n')) !== -1) { frame(buffer.slice(0, end)); buffer = buffer.slice(end + 2) }
      if (buffer.length > 128000) throw new Error('The response was too large. Your entry is saved; please retry.')
      ended = done
    }
    if (buffer.trim()) frame(buffer)
    if (!result) throw new Error('The response connection ended early. Your entry is saved; please retry.')
    return result
  } finally { reader.releaseLock() }
}
