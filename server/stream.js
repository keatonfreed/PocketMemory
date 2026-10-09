// Read only the first JSON string property (reply) while the rest of the plan is
// still arriving. Never expose raw JSON or partial action arguments to the UI.
export function partialReply(json) {
  const match = /^\s*\{\s*"reply"\s*:\s*"/.exec(json)
  if (!match) return ''
  let result = ''
  for (let i = match[0].length; i < json.length; i++) {
    const char = json[i]
    if (char === '"') return result
    if (char !== '\\') { result += char; continue }
    const escape = json[++i]
    if (!escape) break
    if (escape === 'u') {
      const hex = json.slice(i + 1, i + 5)
      if (!/^[0-9a-f]{4}$/i.test(hex)) break
      result += String.fromCharCode(parseInt(hex, 16)); i += 4
    } else {
      const escapes = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '"': '"', '\\': '\\', '/': '/' }
      if (!(escape in escapes)) break
      result += escapes[escape]
    }
  }
  // A Unicode surrogate pair may straddle chunks.
  return /[\uD800-\uDBFF]$/.test(result) ? result.slice(0, -1) : result
}
export function eventStream(res) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()
  function emit(event) {
    if (!res.destroyed && !res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`)
  }
  const heartbeat = setInterval(() => { if (!res.destroyed && !res.writableEnded) res.write(': heartbeat\n\n') }, 15000)
  return { emit, end() { clearInterval(heartbeat); if (!res.writableEnded && !res.destroyed) res.end() } }
}
