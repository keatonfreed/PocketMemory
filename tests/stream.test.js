import test from 'node:test'
import assert from 'node:assert/strict'
import { partialReply, eventStream } from '../server/stream.js'
import { readEventStream } from '../shared/stream.js'
function response(chunks) {
  const encoder = new TextEncoder()
  return new Response(new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(encoder.encode(chunk)); controller.close() } }))
}
test('partial replies decode JSON escapes without exposing action payloads', () => {
  assert.equal(partialReply('{"reply":"Hello\\n\\"Sam\\"'), 'Hello\n"Sam"')
  assert.equal(partialReply('{"reply":"Hello","changes":[{"content":"secret"}]}'), 'Hello')
  assert.equal(partialReply('{"changes":[],"reply":"Hello"}'), '')
  assert.equal(partialReply('{"reply":"\\uD83D'), '')
  assert.equal(partialReply('{"reply":"\\uD83D\\uDE00'), '😀')
  assert.equal(partialReply('{"reply":"Hi\\'), 'Hi')
})
test('SSE reads split frames, CRLF and heartbeats and returns the committed entry', async () => {
  const events = [], entry = { id: 'entry', status: 'done', reply: 'Hi' }
  const result = await readEventStream(response([': heartbeat\r', '\n\r\n', 'data: {"type":"decision","reply":true,"actions":false}\r', '\n\r\n', 'data: {"type":"reply","text":"Hi"}\n', '\n', `data: ${JSON.stringify({ type: 'complete', entry })}\n\n`]), e => events.push(e))
  assert.deepEqual(result, { entry })
  assert.deepEqual(events.map(e => e.type), ['decision', 'reply', 'complete'])
})
test('SSE interruption never reports a provisional reply as committed', async () => {
  await assert.rejects(readEventStream(response(['data: {"type":"reply","text":"Almost"}\n\n'])), /ended early/)
  await assert.rejects(readEventStream(response(['data: {"type":"error","status":503,"code":"AI_TIMEOUT","error":"AI timed out"}\n\n'])), e => e.status === 503 && e.code === 'AI_TIMEOUT')
})
test('server stream sends events and stops writing after closing', () => {
  const res = { headers: {}, messages: [], setHeader(k, v) { this.headers[k] = v }, write(s) { this.messages.push(s) }, end() { this.writableEnded = true } }
  const stream = eventStream(res)
  try {
    stream.emit({ type: 'saved' })
    assert.match(res.headers['Content-Type'], /text\/event-stream/)
    assert.equal(res.messages[0], 'data: {"type":"saved"}\n\n')
  } finally { stream.end() }
  stream.emit({ type: 'saved' })
  assert.equal(res.messages.length, 1)
})
