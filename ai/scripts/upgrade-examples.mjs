import { readFile, writeFile } from 'node:fs/promises'

const dataPath = new URL('../data/examples.json', import.meta.url)
const shortId = (n) => `u${String(n).padStart(7, '0').slice(-7)}`

const item = (n, itemContent, itemCompleted = false) => ({
  itemId: shortId(8000 + n),
  itemContent,
  itemCompleted,
})

const note = (n, docTitle, docSummary, docTags, docContent) => ({
  docId: shortId(n),
  docTitle,
  docSummary,
  docType: 'note',
  docTags,
  docMetadata: {},
  docContent,
})

const list = (n, docTitle, docSummary, docTags, docContent, listType = 'normal') => ({
  docId: shortId(n),
  docTitle,
  docSummary,
  docType: 'list',
  docTags,
  docMetadata: { listType },
  docContent,
})

function toAiItem(value) {
  if (typeof value === 'string') return item(900000 + Math.floor(Math.random() * 100000), value)
  return {
    itemId: value.itemId || value.id || '',
    itemContent: value.itemContent ?? value.content ?? '',
    itemCompleted: Boolean(value.itemCompleted ?? value.completed ?? false),
  }
}

function normalizeDoc(doc) {
  if (doc.docType !== 'list') return doc
  return {
    ...doc,
    docContent: Array.isArray(doc.docContent) ? doc.docContent.map(toAiItem) : [],
  }
}

function normalizeExample(example) {
  const { notes, toolOutput, toolCall, toolCalls, ...rest } = example
  const legacyCalls = Array.isArray(toolCalls) ? toolCalls.filter(Boolean) : (toolCall ? [toolCall] : [])
  return {
    ...rest,
    needDocs: rest.needDocs ?? (legacyCalls.length
      ? legacyCalls.map((call) => ({ plan: planFor(rest, call.docIds || []), docIds: call.docIds || [] }))
      : null),
    documents: (rest.documents || []).map(normalizeDoc),
  }
}

function planFor(example, docIds = []) {
  const titles = docIds.map((docId) => (example.documents || []).find((doc) => doc.docId === docId)?.docTitle).filter(Boolean)
  const titleLabel = titles.length > 1 ? titles.join(', ') : titles[0] || 'the target document'
  const needsModify = (example.final?.actions || []).some((action) => action.actionType === 'modifyDoc')
  return needsModify
    ? `Read ${titleLabel} to preserve existing content and apply the requested edit.`
    : `Read ${titleLabel} to complete the request from existing content.`
}

function example({
  id,
  title,
  category,
  user,
  documents,
  final,
  toolDocId = null,
}) {
  return {
    id,
    title,
    category,
    status: 'draft',
    user,
    documents,
    needDocs: toolDocId ? { plan: planFor({ documents, final }, [toolDocId]), docIds: [toolDocId] } : null,
    final,
  }
}

const grocery = list(201, 'Grocery List', 'Only household grocery list for weekly food shopping.', ['food', 'home'], [
  item(201, 'eggs'),
  item(202, 'apples'),
  item(203, 'almond milk'),
], 'grocery')

const emergencyKit = list(202, 'Emergency Kit', 'Power outage and earthquake supplies kept in the hall closet.', ['home', 'safety'], [
  item(204, 'flashlight'),
  item(205, 'water pouches'),
  item(206, 'first aid refill pack'),
])

const cameraGear = list(203, 'Camera Gear', 'Photography accessories and camera bag restock list.', ['gear', 'photo'], [
  item(207, 'memory cards'),
  item(208, 'lens cloths'),
  item(209, 'spare battery', true),
])

const officeSupplies = list(204, 'Office Supplies', 'Desk and printer supplies for work.', ['work', 'shopping'], [
  item(210, 'printer paper'),
  item(211, 'blue pens'),
])

const campingGear = list(205, 'Camping Gear', 'Gear checklist for camping weekends.', ['travel', 'outdoors'], [
  item(212, 'headlamp'),
  item(213, 'tent stakes'),
])

const giftIdeas = list(206, 'Gift Ideas', 'Gifts to consider for family and friends.', ['personal'], [
  item(214, 'ceramic mug for Ari'),
  item(215, 'garden gloves for Mom'),
])

const quarterlyPlanning = note(207, 'Quarterly Planning', 'Long planning note for Q3 product and operations priorities.', ['work', 'planning'], `Q3 Planning

Goals:
- Improve capture reliability.
- Ship the install flow refresh.
- Reduce notification confusion.

Risks:
- QA bandwidth is thin.
- App copy still has several rough edges.

Open questions:
- Who owns weekly metrics?
- Should launch assets be cut before the beta survey closes?

Decisions:
- Keep the mobile-first layout.
- Delay account sync until the capture flow is stable.`)

const betaFeedback = note(208, 'Beta Feedback Themes', 'Long note summarizing beta user feedback and support patterns.', ['work', 'feedback'], `Beta feedback themes

Positive:
- People like the one-box capture flow.
- Push reminders feel useful when they are rare.

Confusing:
- Some users expect "what's on grocery" to show the list.
- Some users type fragments and expect the app to infer the target.

Requests:
- Better install instructions.
- More obvious saved state after capture.
- Ability to edit examples before training.`)

const birthdayGifts = list(209, 'Birthday Gift List', 'Gift ideas for upcoming birthdays.', ['personal', 'gifts'], [
  item(216, 'cookbook for Maya'),
  item(217, 'museum membership for Dad'),
])

const docsWithCloseLists = [
  cameraGear,
  officeSupplies,
  grocery,
  campingGear,
  emergencyKit,
  giftIdeas,
  quarterlyPlanning,
  betaFeedback,
  birthdayGifts,
]

const additions = [
  example({
    id: 'hard-clear-single-grocery-add',
    title: 'Clear grocery add with one grocery list',
    category: 'modify/tool-then-final',
    user: 'add blueberries to grocery list',
    documents: [note(220, 'Meal Ideas', 'Dinner ideas and rough recipes.', ['food'], 'Lentil soup\nTacos'), grocery, note(221, 'Store Hours', 'Local store opening times.', ['errands'], 'Market closes at 9 PM.')],
    toolDocId: grocery.docId,
    final: {
      actions: [{
        actionType: 'modifyDoc',
        actionPayload: {
          docId: grocery.docId,
          mods: [{ modType: 'addListItem', modPayload: { itemContent: 'blueberries', itemCompleted: false } }],
        },
      }],
    },
  }),
  example({
    id: 'hard-pick-emergency-kit-from-close-lists',
    title: 'Pick emergency kit from several plausible lists',
    category: 'modify/tool-then-final',
    user: 'add AA batteries to the emergency supplies',
    documents: docsWithCloseLists,
    toolDocId: emergencyKit.docId,
    final: {
      actions: [{
        actionType: 'modifyDoc',
        actionPayload: {
          docId: emergencyKit.docId,
          mods: [{ modType: 'addListItem', modPayload: { itemContent: 'AA batteries', itemCompleted: false } }],
        },
      }],
    },
  }),
  example({
    id: 'hard-pick-camera-not-office',
    title: 'Pick camera gear over office supplies',
    category: 'modify/tool-then-final',
    user: 'put lens wipes on the camera bag list',
    documents: [officeSupplies, grocery, campingGear, cameraGear, emergencyKit, betaFeedback],
    toolDocId: cameraGear.docId,
    final: {
      actions: [{
        actionType: 'modifyDoc',
        actionPayload: {
          docId: cameraGear.docId,
          mods: [{ modType: 'addListItem', modPayload: { itemContent: 'lens wipes', itemCompleted: false } }],
        },
      }],
    },
  }),
  example({
    id: 'hard-target-not-first-long-note-edit',
    title: 'Edit long note that is not first in context',
    category: 'modify/tool-then-final',
    user: 'in quarterly planning add that Dana owns weekly metrics',
    documents: [grocery, cameraGear, betaFeedback, giftIdeas, quarterlyPlanning, officeSupplies, emergencyKit],
    toolDocId: quarterlyPlanning.docId,
    final: {
      actions: [{
        actionType: 'modifyDoc',
        actionPayload: {
          docId: quarterlyPlanning.docId,
          mods: [{
            modType: 'editNote',
            modPayload: {
              docContent: `Q3 Planning

Goals:
- Improve capture reliability.
- Ship the install flow refresh.
- Reduce notification confusion.

Risks:
- QA bandwidth is thin.
- App copy still has several rough edges.

Open questions:
- Who owns weekly metrics?
- Should launch assets be cut before the beta survey closes?

Decisions:
- Keep the mobile-first layout.
- Delay account sync until the capture flow is stable.
- Dana owns weekly metrics.`,
            },
          }],
        },
      }],
    },
  }),
  example({
    id: 'hard-edit-long-feedback-note',
    title: 'Edit long feedback note by preserving the whole note',
    category: 'modify/tool-then-final',
    user: 'add to beta feedback that people want a clearer approve button for training data',
    documents: [cameraGear, grocery, quarterlyPlanning, emergencyKit, betaFeedback, birthdayGifts],
    toolDocId: betaFeedback.docId,
    final: {
      actions: [{
        actionType: 'modifyDoc',
        actionPayload: {
          docId: betaFeedback.docId,
          mods: [{
            modType: 'editNote',
            modPayload: {
              docContent: `Beta feedback themes

Positive:
- People like the one-box capture flow.
- Push reminders feel useful when they are rare.

Confusing:
- Some users expect "what's on grocery" to show the list.
- Some users type fragments and expect the app to infer the target.

Requests:
- Better install instructions.
- More obvious saved state after capture.
- Ability to edit examples before training.
- Clearer approve button for training data.`,
            },
          }],
        },
      }],
    },
  }),
  example({
    id: 'hard-similar-items-mark-one-done',
    title: 'Choose exact similar list item',
    category: 'modify/tool-then-final',
    user: 'bought almond milk',
    documents: [grocery, list(230, 'Smoothie Ingredients', 'Ingredients for smoothies and breakfast drinks.', ['food'], [item(230, 'oat milk'), item(231, 'frozen mango')], 'grocery'), cameraGear],
    toolDocId: grocery.docId,
    final: {
      actions: [{
        actionType: 'modifyDoc',
        actionPayload: {
          docId: grocery.docId,
          mods: [{ modType: 'editListItem', modPayload: { itemId: shortId(8203), itemContent: 'almond milk', itemCompleted: true } }],
        },
      }],
    },
  }),
  example({
    id: 'hard-open-not-first-no-tool',
    title: 'Open not-first matching list without tool call',
    category: 'open/no-tool',
    user: "what's on the birthday gift list",
    documents: [grocery, cameraGear, quarterlyPlanning, officeSupplies, birthdayGifts, emergencyKit],
    final: { actions: [{ actionType: 'openDoc', actionPayload: { docId: birthdayGifts.docId } }] },
  }),
  example({
    id: 'hard-create-multiple-documents',
    title: 'Create multiple documents in one request',
    category: 'create/no-tool',
    user: 'remember hotel wifi is AspenGuest / pinecone2026 and make a new Tahoe grocery list with soup, sourdough, cocoa, oranges',
    documents: [grocery, note(240, 'Tahoe Notes', 'Loose notes for the Tahoe weekend.', ['travel'], 'Check-in is after 4 PM.'), campingGear],
    final: {
      actions: [
        {
          actionType: 'createDoc',
          actionPayload: {
            docTitle: 'Hotel Wifi',
            docSummary: 'Hotel wifi network and password for future reference.',
            docType: 'note',
            docContent: 'Hotel wifi: AspenGuest / pinecone2026',
            docTags: ['travel'],
          },
        },
        {
          actionType: 'createDoc',
          actionPayload: {
            docTitle: 'Tahoe Grocery List',
            docSummary: 'Grocery list for the Tahoe trip.',
            docType: 'list',
            docTags: ['travel', 'food'],
            docContent: ['soup', 'sourdough', 'cocoa', 'oranges'],
            docMetadata: { listType: 'grocery' },
          },
        },
      ],
    },
  }),
  example({
    id: 'hard-create-two-separate-notes',
    title: 'Create two separate notes in one message',
    category: 'create/no-tool',
    user: 'save two things: gate code is 4829, and the plumber is Rivas Plumbing 555-0198',
    documents: [grocery, birthdayGifts, emergencyKit],
    final: {
      actions: [
        {
          actionType: 'createDoc',
          actionPayload: {
            docTitle: 'Gate Code',
            docSummary: 'Gate code for future reference.',
            docType: 'note',
            docContent: 'Gate code: 4829',
            docTags: ['home'],
          },
        },
        {
          actionType: 'createDoc',
          actionPayload: {
            docTitle: 'Plumber Contact',
            docSummary: 'Contact information for Rivas Plumbing.',
            docType: 'note',
            docContent: 'Rivas Plumbing: 555-0198',
            docTags: ['home'],
          },
        },
      ],
    },
  }),
]

const dataset = JSON.parse(await readFile(dataPath, 'utf8'))
const existingIds = new Set(dataset.examples.map((entry) => entry.id))

delete dataset.promptTemplate
dataset.examples = dataset.examples.map(normalizeExample)

for (const entry of additions) {
  if (!existingIds.has(entry.id)) dataset.examples.push(normalizeExample(entry))
}

await writeFile(dataPath, `${JSON.stringify(dataset, null, 2)}\n`)
