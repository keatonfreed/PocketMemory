import test from 'node:test'
import assert from 'node:assert/strict'
import { classify, routingDecision, classifierContext } from '../server/classifier.js'
test('reply and action decisions are independent in all four combinations', () => {
  for (const reply of [false, true]) for (const actions of [false, true]) {
    assert.deepEqual(routingDecision({ reply: { noul: reply ? .99 : .01 }, actions: { noul: actions ? .99 : .01 } }), { reply, actions })
  }
})
test('Jev batches typed reply/action questions with personal and time context', async () => {
  const previous = process.env.TYPESAFE_API_KEY
  process.env.TYPESAFE_API_KEY = 'local-test-placeholder'
  const state = { message: 'I love bananas', history: [{ text: 'My breakfast', reply: 'Ideas' }], reminders: [], memories: [], timezone: 'America/Los_Angeles', now: '2026-10-08T18:00:00Z' }
  const choice = value => ({ type: 'choice', choice: value, confidence: .99, probabilities: { [value]: 1 } })
  try {
    const result = await classify(state, { fetcher: async (_url, options) => {
      const payload = JSON.parse(options.body)
      assert.deepEqual(payload.state, state)
      assert.equal(payload.questions.reply.type, 'noul')
      assert.equal(typeof payload.questions.reply.criteria.true, 'string')
      assert.equal(payload.questions.actions.type, 'noul')
      return Response.json({ answers: { intent: choice('remember'), lifetime: choice('durable'), reply: { type: 'noul', noul: .01 }, actions: { type: 'noul', noul: .99 } } })
    } })
    assert.deepEqual(routingDecision(result), { reply: false, actions: true })
  } finally { if (previous === undefined) delete process.env.TYPESAFE_API_KEY; else process.env.TYPESAFE_API_KEY = previous }
})

test('large Jev context fits its budget without clipping the original or recent turns', () => {
  const history = Array.from({ length: 100 }, (_, i) => ({ id: String(i), text: 'A'.repeat(2000), reply: 'B'.repeat(1000) }))
  const state = { message: 'I love bananas', history, reminders: [], memories: Array.from({ length: 300 }, (_, i) => ({ id: String(i), title: 'A fact', content: 'C'.repeat(1500) })) }
  const compact = classifierContext(state)
  assert.ok(Buffer.byteLength(JSON.stringify(compact)) <= 28000)
  assert.equal(compact.message, state.message)
  assert.equal(compact.history.at(-1).text, history.at(-1).text)
  assert.equal(compact.history.at(-1).reply, history.at(-1).reply)
  assert.equal(compact.historyTruncated, true)
  assert.ok(compact.memories.length)
})

test('standalone greetings respond immediately without a Jev call; mixed requests still use Jev', async () => {
  for (const message of ['hi', 'Hey!', "what’s up?", 'how are you']) {
    const result = await classify({ message }, { fetcher: () => assert.fail('Greeting should not call Jev') })
    assert.deepEqual(routingDecision(result), { reply: true, actions: false })
  }
  const previous = process.env.TYPESAFE_API_KEY
  process.env.TYPESAFE_API_KEY = 'local-test-placeholder'
  try {
    for (const message of ['hi, remind me to call Mom', 'I like potatoes']) {
      let called = false
      await assert.rejects(classify({ message }, { fetcher: async () => { called = true; throw new Error('reached Jev') } }), /reached Jev/)
      assert.equal(called, true)
    }
  } finally { if (previous === undefined) delete process.env.TYPESAFE_API_KEY; else process.env.TYPESAFE_API_KEY = previous }
})
