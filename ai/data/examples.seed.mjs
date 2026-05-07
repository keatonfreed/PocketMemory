import { developerPromptTemplate, MODEL } from '../lib/pocket-memory-contract.mjs'

const shortId = (n) => `d${String(n).padStart(7, '0').slice(-7)}`

const item = (n, content, completed = false) => ({
  itemId: shortId(8000 + n),
  itemContent: content,
  itemCompleted: completed,
})

const doc = (n, title, summary, type = 'note', tags = [], content = '', metadata = {}) => ({
  docId: shortId(n),
  docTitle: title,
  docSummary: summary,
  docType: type,
  docTags: tags,
  docMetadata: type === 'list' ? { listType: 'normal', ...metadata } : metadata,
  docContent: content,
})

const note = (n, title, summary, tags, content) => doc(n, title, summary, 'note', tags, content)
const list = (n, title, summary, tags, items, listType = 'normal') => doc(n, title, summary, 'list', tags, items, { listType })

const backgroundDocs = (offset, theme) => [
  note(offset + 1, `${theme} Project Scratch`, `Loose notes for the ${theme.toLowerCase()} project.`, ['work'], `Open questions:\n- Budget owner\n- Timeline\n- Risks`),
  list(offset + 2, `${theme} Errands`, `Things to handle around ${theme.toLowerCase()} week.`, ['personal'], [item(offset + 20, 'Return library book'), item(offset + 21, 'Buy stamps')]),
  note(offset + 3, `${theme} Travel Ideas`, `Places and logistics for a future ${theme.toLowerCase()} trip.`, ['travel'], `Ideas:\n- Book a window seat\n- Pack backup charger`),
  list(offset + 4, `${theme} Reading Queue`, `Articles and books to read later.`, ['reading'], [item(offset + 22, 'Designing Data-Intensive Applications'), item(offset + 23, 'Local-first software essay')]),
  note(offset + 5, `${theme} Gift Ideas`, `Gift ideas for friends and family.`, ['personal'], `Mom: garden gloves\nAri: ceramic coffee dripper`),
  list(offset + 6, `${theme} House Tasks`, `Maintenance and cleaning tasks.`, ['home'], [item(offset + 24, 'Replace air filter'), item(offset + 25, 'Clean fridge shelf')]),
  note(offset + 7, `${theme} Restaurant Notes`, `Restaurants to try and what to order.`, ['food'], `Try:\n- Soba place downtown\n- New taco window`),
  list(offset + 8, `${theme} Work Follow Ups`, `Follow-up tasks for meetings and coworkers.`, ['work'], [item(offset + 26, 'Send Elena metrics'), item(offset + 27, 'Ask Sam about launch date')]),
  note(offset + 9, `${theme} Health Notes`, `Personal health reminders and appointments.`, ['health'], `Stretch calves after running.\nBook dentist in June.`),
  list(offset + 10, `${theme} Supplies`, `Non-grocery supplies to pick up.`, ['shopping'], [item(offset + 28, 'Printer paper'), item(offset + 29, 'Tape')]),
  note(offset + 11, `${theme} Movie List`, `Movies people recommended.`, ['media'], `Past Lives\nAfter Yang\nThe Farewell`),
  list(offset + 12, `${theme} Packing List`, `Reusable packing checklist.`, ['travel'], [item(offset + 30, 'Passport'), item(offset + 31, 'Toiletry bag')]),
]

const example = ({
  id,
  title,
  category,
  user,
  documents,
  final,
  toolDocId = null,
  status = 'draft',
}) => {
  const toolCall = toolDocId ? { name: 'get_docs', docIds: [toolDocId], callId: `call_${id.replace(/-/g, '_')}` } : null

  return {
    id,
    title,
    category,
    status,
    user,
    documents,
    toolCall,
    final,
  }
}

const grocery = list(101, 'Grocery List', 'Main household grocery list for normal weekly shopping.', ['food', 'home'], [
  item(101, 'eggs'),
  item(102, 'spinach'),
  item(103, 'oat milk', true),
  item(104, 'bananas'),
], 'grocery')

const costco = list(102, 'Costco Run', 'Bulk warehouse shopping list.', ['shopping', 'bulk'], [
  item(105, 'paper towels'),
  item(106, 'coffee beans'),
  item(107, 'frozen berries'),
])

const campingFood = list(103, 'Camping Food', 'Food list for the Yosemite camping trip.', ['travel', 'food'], [
  item(108, 'trail mix'),
  item(109, 'instant oatmeal'),
  item(110, 'propane canister'),
])

const launchNote = note(104, 'Launch Notes', 'Checklist and copy notes for the PocketMemory launch.', ['work', 'launch'], 'Launch checklist:\n- Finalize screenshots\n- Confirm app icon\n- Draft Product Hunt blurb')
const dentist = note(105, 'Dentist Details', 'Dental office contact info and appointment notes.', ['health'], 'Dr. Rivera\nMain Street Dental\nNext cleaning: May 18 at 9:30 AM')
const blankIdeas = note(106, 'Weekend Ideas', 'A blank place to collect possible weekend plans.', ['personal'], '')
const reading = list(107, 'Reading Queue', 'Articles and books to read later.', ['reading'], [item(111, 'The Design of Everyday Things'), item(112, 'Local-first software essay')])
const chores = list(108, 'House Chores', 'Recurring home chores.', ['home'], [item(113, 'take out trash'), item(114, 'wash towels', true), item(115, 'water plants')])
const invoices = note(109, 'Client Invoice Notes', 'Notes about client invoice statuses.', ['work', 'finance'], 'Acme: sent March invoice.\nBeta Co: waiting on PO.\nCobalt: paid through April.')

const smallDocs = [grocery, costco, campingFood, launchNote, dentist, blankIdeas, reading, chores, invoices]

const manyDocs = (offset, theme, specialDocs) => [...specialDocs, ...backgroundDocs(offset, theme)]

export const dataset = {
  name: 'PocketMemory queryMemory supervised examples',
  model: MODEL,
  promptTemplate: developerPromptTemplate,
  examples: [
    example({
      id: 'open-grocery-whats-on',
      title: 'Open grocery list for a what-is-on-it query',
      category: 'open/no-tool',
      user: "what's on my grocery list",
      documents: manyDocs(200, 'April', [grocery, costco, campingFood, launchNote]),
      final: { actions: [{ actionType: 'openDoc', actionPayload: { docId: grocery.docId } }] },
    }),
    example({
      id: 'open-specific-note',
      title: 'Open a note by topic',
      category: 'open/no-tool',
      user: 'show me the dentist info',
      documents: manyDocs(220, 'May', [dentist, launchNote, grocery]),
      final: { actions: [{ actionType: 'openDoc', actionPayload: { docId: dentist.docId } }] },
    }),
    example({
      id: 'delete-whole-document-explicit',
      title: 'Delete whole document only when explicit',
      category: 'delete/no-tool',
      user: 'delete the weekend ideas note',
      documents: manyDocs(240, 'June', [blankIdeas, dentist, reading]),
      final: { actions: [{ actionType: 'deleteDoc', actionPayload: { docId: blankIdeas.docId } }] },
    }),
    example({
      id: 'create-note-no-existing-fit',
      title: 'Create a reusable note',
      category: 'create/no-tool',
      user: 'remember that the garage keypad code is 7391',
      documents: manyDocs(260, 'July', [grocery, dentist, invoices]),
      final: {
        actions: [{
          actionType: 'createDoc',
          actionPayload: {
            docTitle: 'Garage Keypad Code',
            docSummary: 'Garage keypad code for future reference.',
            docType: 'note',
            docContent: 'Garage keypad code: 7391',
            docTags: ['home'],
          },
        }],
      },
    }),
    example({
      id: 'create-new-list-explicit',
      title: 'Create separate list when user says new',
      category: 'create/no-tool',
      user: 'make a new packing list for the Tahoe cabin: gloves, snow boots, charger, tea bags',
      documents: manyDocs(280, 'August', [grocery, campingFood, reading]),
      final: {
        actions: [{
          actionType: 'createDoc',
          actionPayload: {
            docTitle: 'Tahoe Cabin Packing List',
            docSummary: 'Packing list for the Tahoe cabin trip.',
            docType: 'list',
            docTags: ['travel'],
            docContent: ['gloves', 'snow boots', 'charger', 'tea bags'],
            docMetadata: { listType: 'normal' },
          },
        }],
      },
    }),
    example({
      id: 'noop-gibberish',
      title: 'No action for gibberish',
      category: 'no-op/no-tool',
      user: 'asdf jkl; blue spoon wobble test test',
      documents: manyDocs(300, 'September', [grocery, launchNote, chores]),
      final: { actions: [] },
    }),
    example({
      id: 'add-milk-best-judgment',
      title: 'Add milk to grocery list, not Costco or camping',
      category: 'modify/tool-then-final',
      user: 'add milk to the list',
      documents: manyDocs(320, 'October', [grocery, costco, campingFood, chores]),
      toolDocId: grocery.docId,
      final: {
        actions: [{
          actionType: 'modifyDoc',
          actionPayload: {
            docId: grocery.docId,
            mods: [{ modType: 'addListItem', modPayload: { itemContent: 'milk', itemCompleted: false } }],
          },
        }],
      },
    }),
    example({
      id: 'add-bulk-item-costco',
      title: 'Add bulk item to Costco list',
      category: 'modify/tool-then-final',
      user: 'put a giant thing of laundry detergent on costco',
      documents: manyDocs(340, 'November', [grocery, costco, campingFood, chores]),
      toolDocId: costco.docId,
      final: {
        actions: [{
          actionType: 'modifyDoc',
          actionPayload: {
            docId: costco.docId,
            mods: [{ modType: 'addListItem', modPayload: { itemContent: 'giant thing of laundry detergent', itemCompleted: false } }],
          },
        }],
      },
    }),
    example({
      id: 'mark-item-done',
      title: 'Mark list item complete',
      category: 'modify/tool-then-final',
      user: 'mark bananas off grocery',
      documents: manyDocs(360, 'December', [grocery, costco, chores]),
      toolDocId: grocery.docId,
      final: {
        actions: [{
          actionType: 'modifyDoc',
          actionPayload: {
            docId: grocery.docId,
            mods: [{ modType: 'editListItem', modPayload: { itemId: shortId(8104), itemContent: 'bananas', itemCompleted: true } }],
          },
        }],
      },
    }),
    example({
      id: 'restore-item',
      title: 'Restore a completed item',
      category: 'modify/tool-then-final',
      user: 'actually put oat milk back on grocery, we still need it',
      documents: manyDocs(380, 'January', [grocery, costco, chores]),
      toolDocId: grocery.docId,
      final: {
        actions: [{
          actionType: 'modifyDoc',
          actionPayload: {
            docId: grocery.docId,
            mods: [{ modType: 'editListItem', modPayload: { itemId: shortId(8103), itemContent: 'oat milk', itemCompleted: false } }],
          },
        }],
      },
    }),
    example({
      id: 'delete-list-item',
      title: 'Delete one list item, not whole document',
      category: 'modify/tool-then-final',
      user: 'delete spinach from grocery',
      documents: manyDocs(400, 'February', [grocery, costco, campingFood]),
      toolDocId: grocery.docId,
      final: {
        actions: [{
          actionType: 'modifyDoc',
          actionPayload: {
            docId: grocery.docId,
            mods: [{ modType: 'deleteListItem', modPayload: { itemId: shortId(8102) } }],
          },
        }],
      },
    }),
    example({
      id: 'multiple-list-edits-one-fetch',
      title: 'Multiple mods after one fetch',
      category: 'modify/tool-then-final',
      user: 'add yogurt to grocery and mark eggs done',
      documents: manyDocs(420, 'March', [grocery, costco, chores]),
      toolDocId: grocery.docId,
      final: {
        actions: [{
          actionType: 'modifyDoc',
          actionPayload: {
            docId: grocery.docId,
            mods: [
              { modType: 'addListItem', modPayload: { itemContent: 'yogurt', itemCompleted: false } },
              { modType: 'editListItem', modPayload: { itemId: shortId(8101), itemContent: 'eggs', itemCompleted: true } },
            ],
          },
        }],
      },
    }),
    example({
      id: 'edit-note-append',
      title: 'Append to note by rewriting full note',
      category: 'modify/tool-then-final',
      user: 'add to launch notes: remember to record a 20 second demo',
      documents: manyDocs(440, 'Product', [launchNote, invoices, reading]),
      toolDocId: launchNote.docId,
      final: {
        actions: [{
          actionType: 'modifyDoc',
          actionPayload: {
            docId: launchNote.docId,
            mods: [{
              modType: 'editNote',
              modPayload: {
                docContent: 'Launch checklist:\n- Finalize screenshots\n- Confirm app icon\n- Draft Product Hunt blurb\n- Remember to record a 20 second demo',
              },
            }],
          },
        }],
      },
    }),
    example({
      id: 'edit-empty-note',
      title: 'Edit empty note after one fetch',
      category: 'modify/tool-then-final',
      user: 'add farmers market and coffee walk to weekend ideas',
      documents: manyDocs(460, 'Personal', [blankIdeas, grocery, chores]),
      toolDocId: blankIdeas.docId,
      final: {
        actions: [{
          actionType: 'modifyDoc',
          actionPayload: {
            docId: blankIdeas.docId,
            mods: [{ modType: 'editNote', modPayload: { docContent: 'Weekend ideas:\n- Farmers market\n- Coffee walk' } }],
          },
        }],
      },
    }),
    example({
      id: 'open-not-modify-when-show',
      title: 'Do not fetch for show/open wording',
      category: 'open/no-tool',
      user: 'pull up the launch notes',
      documents: manyDocs(480, 'Startup', [launchNote, invoices, grocery]),
      final: { actions: [{ actionType: 'openDoc', actionPayload: { docId: launchNote.docId } }] },
    }),
    example({
      id: 'create-explicit-separate-even-similar',
      title: 'Create when user explicitly asks separate',
      category: 'create/no-tool',
      user: 'make a separate list for camping snacks: jerky, dried mango, electrolyte packets',
      documents: manyDocs(500, 'Outdoors', [campingFood, grocery, costco]),
      final: {
        actions: [{
          actionType: 'createDoc',
          actionPayload: {
            docTitle: 'Camping Snacks',
            docSummary: 'Separate snack list for camping.',
            docType: 'list',
            docTags: ['travel', 'food'],
            docContent: ['jerky', 'dried mango', 'electrolyte packets'],
            docMetadata: { listType: 'normal' },
          },
        }],
      },
    }),
    example({
      id: 'delete-ambiguous-doc-noop',
      title: 'No action when whole-document delete is unsafe',
      category: 'no-op/no-tool',
      user: 'delete the notes',
      documents: manyDocs(520, 'Mixed', [launchNote, dentist, invoices, blankIdeas]),
      final: { actions: [] },
    }),
    example({
      id: 'edit-specific-list-item-text',
      title: 'Rename list item while preserving completed state',
      category: 'modify/tool-then-final',
      user: 'change paper towels on costco to the kirkland paper towels',
      documents: manyDocs(540, 'Warehouse', [costco, grocery, chores]),
      toolDocId: costco.docId,
      final: {
        actions: [{
          actionType: 'modifyDoc',
          actionPayload: {
            docId: costco.docId,
            mods: [{ modType: 'editListItem', modPayload: { itemId: shortId(8105), itemContent: 'kirkland paper towels', itemCompleted: false } }],
          },
        }],
      },
    }),
    example({
      id: 'giant-context-open-no-tool',
      title: 'Large context still does not fetch for open',
      category: 'open/no-tool',
      user: 'open my client invoice notes',
      documents: manyDocs(560, 'Ops', [invoices, launchNote, dentist, grocery, costco, campingFood, blankIdeas, reading, chores, ...backgroundDocs(700, 'Deep Archive'), ...backgroundDocs(760, 'Old Archive')]),
      final: { actions: [{ actionType: 'openDoc', actionPayload: { docId: invoices.docId } }] },
    }),
    example({
      id: 'giant-context-modify-one-fetch',
      title: 'Large context mod fetches only the best document once',
      category: 'modify/tool-then-final',
      user: 'add ask Sam about renewal date to work follow ups',
      documents: manyDocs(820, 'Quarterly', [invoices, launchNote, grocery, ...backgroundDocs(880, 'Long Tail')]),
      toolDocId: shortId(828),
      final: {
        actions: [{
          actionType: 'modifyDoc',
          actionPayload: {
            docId: shortId(828),
            mods: [{ modType: 'addListItem', modPayload: { itemContent: 'ask Sam about renewal date', itemCompleted: false } }],
          },
        }],
      },
    }),
    example({
      id: 'quick-short-capture',
      title: 'Very short capture creates note',
      category: 'create/no-tool',
      user: 'Gate code 1842',
      documents: [grocery, chores, dentist],
      final: {
        actions: [{
          actionType: 'createDoc',
          actionPayload: {
            docTitle: 'Gate Code',
            docSummary: 'Gate code for future reference.',
            docType: 'note',
            docContent: 'Gate code: 1842',
            docTags: [],
          },
        }],
      },
    }),
    example({
      id: 'typo-heavy-modify',
      title: 'Typo-heavy list add',
      category: 'modify/tool-then-final',
      user: 'pls add tortilas to grocry list',
      documents: manyDocs(940, 'Typo', [grocery, costco, campingFood]),
      toolDocId: grocery.docId,
      final: {
        actions: [{
          actionType: 'modifyDoc',
          actionPayload: {
            docId: grocery.docId,
            mods: [{ modType: 'addListItem', modPayload: { itemContent: 'tortilas', itemCompleted: false } }],
          },
        }],
      },
    }),
    example({
      id: 'open-short-list-name',
      title: 'Short open request does not fetch',
      category: 'open/no-tool',
      user: 'costco',
      documents: manyDocs(980, 'Short', [grocery, costco, campingFood, invoices]),
      final: { actions: [{ actionType: 'openDoc', actionPayload: { docId: costco.docId } }] },
    }),
    example({
      id: 'delete-whole-list-explicit',
      title: 'Delete whole list when explicit',
      category: 'delete/no-tool',
      user: 'delete the costco run list',
      documents: manyDocs(1000, 'Delete', [grocery, costco, campingFood, chores]),
      final: { actions: [{ actionType: 'deleteDoc', actionPayload: { docId: costco.docId } }] },
    }),
    example({
      id: 'add-camping-food-best-match',
      title: 'Choose camping food over grocery for trip-specific item',
      category: 'modify/tool-then-final',
      user: 'add marshmallows to the camping food list',
      documents: manyDocs(1020, 'Outdoors', [grocery, costco, campingFood, chores]),
      toolDocId: campingFood.docId,
      final: {
        actions: [{
          actionType: 'modifyDoc',
          actionPayload: {
            docId: campingFood.docId,
            mods: [{ modType: 'addListItem', modPayload: { itemContent: 'marshmallows', itemCompleted: false } }],
          },
        }],
      },
    }),
    example({
      id: 'done-word-bought',
      title: 'Bought means mark completed',
      category: 'modify/tool-then-final',
      user: 'bought coffee beans from costco',
      documents: manyDocs(1040, 'Bulk', [grocery, costco, campingFood]),
      toolDocId: costco.docId,
      final: {
        actions: [{
          actionType: 'modifyDoc',
          actionPayload: {
            docId: costco.docId,
            mods: [{ modType: 'editListItem', modPayload: { itemId: shortId(8106), itemContent: 'coffee beans', itemCompleted: true } }],
          },
        }],
      },
    }),
    example({
      id: 'note-rewrite-specific-line',
      title: 'Rewrite note while preserving unrelated lines',
      category: 'modify/tool-then-final',
      user: 'in invoice notes change beta co to PO received',
      documents: manyDocs(1060, 'Finance', [invoices, launchNote, dentist, grocery]),
      toolDocId: invoices.docId,
      final: {
        actions: [{
          actionType: 'modifyDoc',
          actionPayload: {
            docId: invoices.docId,
            mods: [{
              modType: 'editNote',
              modPayload: {
                docContent: 'Acme: sent March invoice.\nBeta Co: PO received.\nCobalt: paid through April.',
              },
            }],
          },
        }],
      },
    }),
    example({
      id: 'create-grocery-when-none',
      title: 'Create grocery list when none exists',
      category: 'create/no-tool',
      user: 'grocery list: rice, black beans, cilantro, limes',
      documents: manyDocs(1080, 'No Grocery', [launchNote, dentist, chores, invoices]),
      final: {
        actions: [{
          actionType: 'createDoc',
          actionPayload: {
            docTitle: 'Grocery List',
            docSummary: 'Main grocery list for household shopping.',
            docType: 'list',
            docTags: ['food', 'home'],
            docContent: ['rice', 'black beans', 'cilantro', 'limes'],
            docMetadata: { listType: 'grocery' },
          },
        }],
      },
    }),
    example({
      id: 'ambiguous-list-equally-plausible-noop',
      title: 'No action only for truly equal-risk ambiguity',
      category: 'no-op/no-tool',
      user: 'add batteries to the list',
      documents: [
        list(1301, 'Emergency Kit List', 'Supplies for power outages and earthquakes.', ['home'], [item(1301, 'flashlight')]),
        list(1302, 'Camera Gear List', 'Photography gear and accessories to buy.', ['gear'], [item(1302, 'memory cards')]),
        list(1303, 'Office Supplies List', 'Work supplies to restock.', ['work'], [item(1303, 'notebooks')]),
        ...backgroundDocs(1100, 'Ambiguous'),
      ],
      final: { actions: [] },
    }),
    example({
      id: 'random-playful-noop',
      title: 'No action for playful non-instruction',
      category: 'no-op/no-tool',
      user: 'banana keyboard spaceship lol',
      documents: manyDocs(1120, 'Playful', [grocery, costco, launchNote, chores]),
      final: { actions: [] },
    }),
    example({
      id: 'obvious-test-noop',
      title: 'No action for explicit test typing',
      category: 'no-op/no-tool',
      user: 'testing testing 123 ignore this',
      documents: smallDocs,
      final: { actions: [] },
    }),
    example({
      id: 'short-greeting-hey-there-noop',
      title: 'No action for a short friendly greeting',
      category: 'no-op/no-tool',
      user: 'hey there',
      documents: [
        note(1401, 'Porch Garden Plan', 'Ideas for herbs, planters, and watering rhythm.', ['home', 'garden'], 'Basil in the blue pot.\nMint needs its own container.'),
        list(1402, 'Tiny Errands', 'Small errands that can wait until the weekend.', ['personal'], [item(1401, 'drop off library tote'), item(1402, 'buy postcard stamps')]),
        note(1403, 'Jazz Night Ideas', 'Venues and friends to invite for a low-key music night.', ['personal', 'music'], 'Try the Thursday set at Blue Room.\nAsk Nia if she wants to go.'),
      ],
      final: { actions: [] },
    }),
    example({
      id: 'short-greeting-hello-pocket-memory-noop',
      title: 'No action for hello addressed to app',
      category: 'no-op/no-tool',
      user: 'hello pocket memory',
      documents: [
        list(1411, 'Market Colors', 'Color notes for flowers and table settings.', ['creative'], [item(1411, 'marigold napkins'), item(1412, 'deep green ribbon')]),
        note(1412, 'Studio Door Code', 'Reference details for the ceramics studio.', ['reference'], 'Studio code changes monthly.\nAsk Jules before Saturday.'),
        note(1413, 'Soup Experiments', 'Loose notes on soups worth making again.', ['food'], 'White bean with rosemary worked well.\nNeeds more lemon next time.'),
      ],
      final: { actions: [] },
    }),
    example({
      id: 'short-greeting-morning-noop',
      title: 'No action for one-word morning greeting',
      category: 'no-op/no-tool',
      user: 'morning',
      documents: [
        note(1421, 'Window Measurements', 'Measurements for curtains and replacement screens.', ['home'], 'Kitchen window: 34 x 46.\nOffice window: 29 x 42.'),
        list(1422, 'Train Snack List', 'Snacks to pack for longer train rides.', ['travel', 'food'], [item(1421, 'clementines'), item(1422, 'salted almonds')]),
        note(1423, 'Bookshop Finds', 'Interesting books spotted while browsing.', ['reading'], 'A field guide to clouds.\nUsed copy of The Lathe of Heaven.'),
      ],
      final: { actions: [] },
    }),
    example({
      id: 'draft-preference-note-over-grocery-bananas-open',
      title: 'Choose banana preference note over grocery list and open it',
      category: 'draft/selection-note-over-list',
      user: 'add chocolate covered bananas are the best then open it',
      documents: [
        list(1431, 'Grocery List', 'Main grocery list for household shopping.', ['food', 'home'], [item(1431, 'bananas'), item(1432, 'potatoes'), item(1433, 'peanuts')], 'grocery'),
        note(1432, 'Banana Liking with Peeled', 'A note about my banana preferences.', ['food'], 'I like bananas peeled.'),
        note(1433, 'Dessert Ideas', 'Sweet things to try later.', ['food'], 'Brown butter cookies\nLemon bars'),
        list(1434, 'Kitchen Restock', 'Kitchen supplies and non-food restocks.', ['shopping'], [item(1434, 'parchment paper'), item(1435, 'dish soap')]),
      ],
      toolDocId: shortId(1432),
      final: {
        actions: [
          {
            actionType: 'modifyDoc',
            actionPayload: {
              docId: shortId(1432),
              mods: [{
                modType: 'editNote',
                modPayload: { docContent: 'I like bananas peeled.\nChocolate covered bananas are the best.' },
              }],
            },
          },
          { actionType: 'openDoc', actionPayload: { docId: shortId(1432) } },
        ],
      },
    }),
    example({
      id: 'draft-preference-note-over-grocery-coffee-open',
      title: 'Choose taste preference note over shopping list and open it',
      category: 'draft/selection-note-over-list',
      user: 'add cold brew tastes better with oat milk then open it',
      documents: [
        list(1441, 'Grocery List', 'Main grocery list for household shopping.', ['food', 'home'], [item(1441, 'cold brew'), item(1442, 'oat milk'), item(1443, 'eggs')], 'grocery'),
        note(1442, 'Coffee Preferences', 'Notes about coffee tastes and drink preferences.', ['food', 'coffee'], 'Espresso should be short and not too bitter.'),
        note(1443, 'Cafe Ideas', 'Cafes to try and what to order.', ['food'], 'Try the quiet place by the library.'),
        list(1444, 'Office Drinks', 'Drinks to stock for office days.', ['work', 'shopping'], [item(1444, 'tea bags'), item(1445, 'sparkling water')]),
      ],
      toolDocId: shortId(1442),
      final: {
        actions: [
          {
            actionType: 'modifyDoc',
            actionPayload: {
              docId: shortId(1442),
              mods: [{
                modType: 'editNote',
                modPayload: { docContent: 'Espresso should be short and not too bitter.\nCold brew tastes better with oat milk.' },
              }],
            },
          },
          { actionType: 'openDoc', actionPayload: { docId: shortId(1442) } },
        ],
      },
    }),
  ],
}
