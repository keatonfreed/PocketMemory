import fs from 'node:fs'
import { validateDataset } from '../lib/format.mjs'
import { developerPromptTemplate } from '../lib/pocket-memory-contract.mjs'

const DATASET_PATH = new URL('../data/examples.json', import.meta.url)

const shortId = (n) => `f${String(n).padStart(7, '0').slice(-7)}`

const item = (n, content, completed = false) => ({
  itemId: shortId(9000 + n),
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

const backgrounds = (offset, theme) => [
  note(offset + 1, `${theme} Scratchpad`, `Loose notes for ${theme.toLowerCase()} planning.`, ['work'], 'Follow up with Sam.\nCheck dates.'),
  list(offset + 2, `${theme} Shopping`, `Non-grocery shopping ideas for ${theme.toLowerCase()}.`, ['shopping'], [item(offset + 20, 'printer paper'), item(offset + 21, 'batteries')]),
  note(offset + 3, `${theme} Movies`, `Movies and shows people mentioned.`, ['media'], 'Arrival\nThe Farewell\nPast Lives'),
  list(offset + 4, `${theme} Packing`, `Reusable packing checklist.`, ['travel'], [item(offset + 22, 'charger'), item(offset + 23, 'toiletry bag')]),
  note(offset + 5, `${theme} Gift Ideas`, `Gift ideas for later.`, ['personal'], 'Mia: fountain pen\nDad: puzzle book'),
  list(offset + 6, `${theme} House Tasks`, `House maintenance tasks.`, ['home'], [item(offset + 24, 'replace air filter'), item(offset + 25, 'clean sink')]),
  note(offset + 7, `${theme} Restaurant Notes`, `Restaurants to try.`, ['food'], 'Soba place downtown\nNew taco window'),
  list(offset + 8, `${theme} Reading`, `Articles and books to read.`, ['reading'], [item(offset + 26, 'local-first essay'), item(offset + 27, 'database notes')]),
]

const toolCall = (id, docIds) => ({ name: 'get_docs', docIds, callId: `call_${id.replace(/-/g, '_')}` })

const example = ({ id, title, category, user, documents, final, toolDocIds = [], status = 'draft' }) => {
  const calls = toolDocIds.length ? [toolCall(id, [...new Set(toolDocIds)])] : []
  return {
    id,
    title,
    category,
    status,
    user,
    documents,
    ...(calls.length === 1 ? { toolCall: calls[0] } : calls.length > 1 ? { toolCalls: calls } : {}),
    final,
  }
}

const examples = []

{
  const powers = list(101, 'Superman Powers', 'Empty list for Superman power ideas.', ['comics'], [])
  const spider = list(102, 'Spider-Man Powers', 'List of Spider-Man abilities.', ['comics'], [item(1, 'wall crawling'), item(2, 'spider sense')])
  examples.push(example({
    id: 'failure-existing-empty-powers-list',
    title: 'Add powers to existing empty character list instead of creating duplicate',
    category: 'failure-fix/modify-existing-list',
    user: 'add flight, x-ray vision through walls except lead, heat vision, freeze breath, and super strength to superman powers',
    documents: [note(103, 'Hero Movie Ideas', 'Movie ideas about superheroes.', ['media'], 'Watch the older animated movies.'), spider, ...backgrounds(300, 'Comic'), powers],
    toolDocIds: [powers.docId],
    final: {
      actions: [{
        actionType: 'modifyDoc',
        actionPayload: {
          docId: powers.docId,
          mods: [
            { modType: 'addListItem', modPayload: { itemContent: 'flight', itemCompleted: false } },
            { modType: 'addListItem', modPayload: { itemContent: 'x-ray vision through walls except lead', itemCompleted: false } },
            { modType: 'addListItem', modPayload: { itemContent: 'heat vision', itemCompleted: false } },
            { modType: 'addListItem', modPayload: { itemContent: 'freeze breath', itemCompleted: false } },
            { modType: 'addListItem', modPayload: { itemContent: 'super strength', itemCompleted: false } },
          ],
        },
      }],
    },
  }))
}

{
  const grocery = list(120, 'Grocery List', 'Pinned main grocery list for weekly food shopping.', ['food', 'home'], [item(30, 'eggs'), item(31, 'rice')], 'grocery')
  const mealIdeas = note(121, 'Meal Ideas', 'Meal ideas and recipes.', ['food'], 'Peanut noodles\nPotato tacos')
  examples.push(example({
    id: 'failure-existing-grocery-no-create-no-open',
    title: 'Add grocery items to existing grocery list without creating/opening extra docs',
    category: 'failure-fix/grocery-existing-list',
    user: 'add bananas, potatoes, and peanuts to my list',
    documents: [grocery, mealIdeas, ...backgrounds(330, 'Kitchen')],
    toolDocIds: [grocery.docId],
    final: {
      actions: [{
        actionType: 'modifyDoc',
        actionPayload: {
          docId: grocery.docId,
          mods: [
            { modType: 'addListItem', modPayload: { itemContent: 'bananas', itemCompleted: false } },
            { modType: 'addListItem', modPayload: { itemContent: 'potatoes', itemCompleted: false } },
            { modType: 'addListItem', modPayload: { itemContent: 'peanuts', itemCompleted: false } },
          ],
        },
      }],
    },
  }))
}

{
  const hashtags = note(140, 'New Hashtags', 'Reusable hashtags for social posts.', ['social'], '#pocketmemory\n#secondbrain\n#lifelog')
  examples.push(example({
    id: 'failure-add-hashtags-to-note-use-edit-note',
    title: 'Adding hashtags to a note uses editNote, not addListItem',
    category: 'failure-fix/note-edit-hashtags',
    user: 'add 5 hashtags about memory, notes, productivity, reminders, and organizing to new hashtags',
    documents: [hashtags, ...backgrounds(360, 'Social')],
    toolDocIds: [hashtags.docId],
    final: {
      actions: [{
        actionType: 'modifyDoc',
        actionPayload: {
          docId: hashtags.docId,
          mods: [{
            modType: 'editNote',
            modPayload: {
              docContent: '#pocketmemory\n#secondbrain\n#lifelog\n#memory\n#notes\n#productivity\n#reminders\n#organizing',
            },
          }],
        },
      }],
    },
  }))

  examples.push(example({
    id: 'failure-remove-hashtag-from-note-use-edit-note',
    title: 'Removing a hashtag from a note uses editNote',
    category: 'failure-fix/note-edit-hashtags',
    user: 'remove the lifelog hashtag from new hashtags',
    documents: [hashtags, ...backgrounds(390, 'Campaign')],
    toolDocIds: [hashtags.docId],
    final: {
      actions: [{
        actionType: 'modifyDoc',
        actionPayload: {
          docId: hashtags.docId,
          mods: [{
            modType: 'editNote',
            modPayload: { docContent: '#pocketmemory\n#secondbrain' },
          }],
        },
      }],
    },
  }))

  examples.push(example({
    id: 'failure-add-lines-to-note-not-list-items',
    title: 'Adding lines to a note still uses editNote',
    category: 'failure-fix/note-edit-lines',
    user: 'add a few launch caption ideas under the hashtags note',
    documents: [hashtags, ...backgrounds(420, 'Launch')],
    toolDocIds: [hashtags.docId],
    final: {
      actions: [{
        actionType: 'modifyDoc',
        actionPayload: {
          docId: hashtags.docId,
          mods: [{
            modType: 'editNote',
            modPayload: {
              docContent: '#pocketmemory\n#secondbrain\n#lifelog\n\nCaption ideas:\n- Your notes should remember the small stuff for you.\n- Capture it once, find it later.\n- A tiny second brain for everyday life.',
            },
          }],
        },
      }],
    },
  }))
}

{
  const superman = list(160, 'Superman Powers', 'Power list for Superman.', ['comics'], [item(50, 'flight')])
  const spider = list(161, 'Spider-Man Powers', 'Power list for Spider-Man.', ['comics'], [item(51, 'wall crawling')])
  examples.push(example({
    id: 'failure-all-means-topic-items-not-literal-word',
    title: 'Add all known topic items, not the literal word all, to the right document',
    category: 'failure-fix/list-add-topic-items',
    user: 'add all of spidermans powers to spiderman powers',
    documents: [superman, ...backgrounds(450, 'Hero'), spider],
    toolDocIds: [spider.docId],
    final: {
      actions: [{
        actionType: 'modifyDoc',
        actionPayload: {
          docId: spider.docId,
          mods: [
            { modType: 'addListItem', modPayload: { itemContent: 'spider sense', itemCompleted: false } },
            { modType: 'addListItem', modPayload: { itemContent: 'superhuman strength', itemCompleted: false } },
            { modType: 'addListItem', modPayload: { itemContent: 'superhuman agility', itemCompleted: false } },
            { modType: 'addListItem', modPayload: { itemContent: 'web swinging', itemCompleted: false } },
          ],
        },
      }],
    },
  }))

  const allList = list(162, 'Superman Powers', 'Power list that accidentally has a bad item.', ['comics'], [item(52, 'flight'), item(53, 'all'), item(54, 'heat vision')])
  examples.push(example({
    id: 'failure-remove-literal-word-from-list',
    title: 'Remove a literal bad list item instead of opening the document',
    category: 'failure-fix/list-delete-item',
    user: 'remove the word all from supermans powers list',
    documents: [spider, ...backgrounds(480, 'League'), allList],
    toolDocIds: [allList.docId],
    final: {
      actions: [{
        actionType: 'modifyDoc',
        actionPayload: {
          docId: allList.docId,
          mods: [{ modType: 'deleteListItem', modPayload: { itemId: shortId(9053) } }],
        },
      }],
    },
  }))
}

{
  const prep = list(180, 'All Seasons Prep', 'Combined prep list with one item per season.', ['home'], [
    item(70, 'Spring: clean gutters, check garden soil, test irrigation'),
    item(71, 'Summer: service AC, buy sunblock, check fans'),
    item(72, 'Fall: rake leaves, inspect heater, seal window gaps'),
    item(73, 'Winter: cover outdoor faucets, stock ice melt, check blankets'),
  ])
  examples.push(example({
    id: 'failure-split-combined-season-list',
    title: 'Scan a combined list before deleting and creating four replacement lists',
    category: 'failure-fix/create-and-delete-from-source',
    user: 'delete the prep list for all 4 seasons, but instead make 4 separate lists, one for each season, with the items as list items in each',
    documents: [prep, ...backgrounds(510, 'Home')],
    toolDocIds: [prep.docId],
    final: {
      actions: [
        { actionType: 'createDoc', actionPayload: { docTitle: 'Spring Prep', docSummary: 'Prep checklist for spring.', docType: 'list', docTags: ['home'], docContent: ['clean gutters', 'check garden soil', 'test irrigation'], docMetadata: { listType: 'normal' } } },
        { actionType: 'createDoc', actionPayload: { docTitle: 'Summer Prep', docSummary: 'Prep checklist for summer.', docType: 'list', docTags: ['home'], docContent: ['service AC', 'buy sunblock', 'check fans'], docMetadata: { listType: 'normal' } } },
        { actionType: 'createDoc', actionPayload: { docTitle: 'Fall Prep', docSummary: 'Prep checklist for fall.', docType: 'list', docTags: ['home'], docContent: ['rake leaves', 'inspect heater', 'seal window gaps'], docMetadata: { listType: 'normal' } } },
        { actionType: 'createDoc', actionPayload: { docTitle: 'Winter Prep', docSummary: 'Prep checklist for winter.', docType: 'list', docTags: ['home'], docContent: ['cover outdoor faucets', 'stock ice melt', 'check blankets'], docMetadata: { listType: 'normal' } } },
        { actionType: 'deleteDoc', actionPayload: { docId: prep.docId } },
      ],
    },
  }))

  examples.push(example({
    id: 'failure-create-four-season-lists-no-source',
    title: 'Create all four requested lists in one final response',
    category: 'failure-fix/multiple-create',
    user: 'make prep lists for all 4 seasons of the year, so 4 total lists, each with 3-5 items needed to prep for that season',
    documents: backgrounds(540, 'Home'),
    final: {
      actions: [
        { actionType: 'createDoc', actionPayload: { docTitle: 'Spring Prep', docSummary: 'Prep checklist for spring.', docType: 'list', docTags: ['home'], docContent: ['clean gutters', 'check garden soil', 'test irrigation', 'wash outdoor cushions'], docMetadata: { listType: 'normal' } } },
        { actionType: 'createDoc', actionPayload: { docTitle: 'Summer Prep', docSummary: 'Prep checklist for summer.', docType: 'list', docTags: ['home'], docContent: ['service AC', 'buy sunblock', 'check fans', 'water plants deeply'], docMetadata: { listType: 'normal' } } },
        { actionType: 'createDoc', actionPayload: { docTitle: 'Fall Prep', docSummary: 'Prep checklist for fall.', docType: 'list', docTags: ['home'], docContent: ['rake leaves', 'inspect heater', 'seal window gaps', 'store patio gear'], docMetadata: { listType: 'normal' } } },
        { actionType: 'createDoc', actionPayload: { docTitle: 'Winter Prep', docSummary: 'Prep checklist for winter.', docType: 'list', docTags: ['home'], docContent: ['cover outdoor faucets', 'stock ice melt', 'check blankets', 'test smoke detectors'], docMetadata: { listType: 'normal' } } },
      ],
    },
  }))
}

{
  const donuts = note(210, 'Donut Notes', 'Notes about donut preferences.', ['food'], 'Chocolate donuts\nKrispy Kreme glazed\nasdjhkasouyd asuoi\nblue table moon sentence')
  examples.push(example({
    id: 'failure-clean-random-text-in-note-not-delete-doc',
    title: 'Delete random text inside a note without deleting the whole document',
    category: 'failure-fix/note-cleanup',
    user: 'delete the random stuff in the donuts doc, just keep the donut related stuff',
    documents: [donuts, ...backgrounds(570, 'Food')],
    toolDocIds: [donuts.docId],
    final: {
      actions: [{
        actionType: 'modifyDoc',
        actionPayload: {
          docId: donuts.docId,
          mods: [{ modType: 'editNote', modPayload: { docContent: 'Chocolate donuts\nKrispy Kreme glazed' } }],
        },
      }],
    },
  }))

  const best = note(211, 'Best Kinds of Donuts', 'Favorite donut types and notes.', ['food'], 'Best kinds of donuts:\n- Chocolate\n- Glazed\n- Liek onyl from ksitpry kras in area\n\nLiek, crunchier the better.')
  const empty = note(212, 'Donut Notes', 'Empty accidental duplicate donut note.', ['food'], '')
  examples.push(example({
    id: 'failure-fix-spelling-existing-donut-note',
    title: 'Fix spelling in existing note instead of creating a duplicate',
    category: 'failure-fix/note-spelling',
    user: 'fix the spelling mistakes in best kinds of donuts',
    documents: [empty, ...backgrounds(600, 'Bakery'), best],
    toolDocIds: [best.docId],
    final: {
      actions: [{
        actionType: 'modifyDoc',
        actionPayload: {
          docId: best.docId,
          mods: [{
            modType: 'editNote',
            modPayload: { docContent: 'Best kinds of donuts:\n- Chocolate\n- Glazed\n- Only from Krispy Kreme in the area\n\nCrunchier the better.' },
          }],
        },
      }],
    },
  }))

  examples.push(example({
    id: 'failure-delete-duplicate-and-edit-original',
    title: 'Delete the duplicate note and edit the correct original note',
    category: 'failure-fix/delete-plus-modify',
    user: 'delete the empty donut notes doc, and then edit the best kinds of donuts doc and fix just the spelling mistakes while keeping all information',
    documents: [empty, ...backgrounds(630, 'Dessert'), best],
    toolDocIds: [best.docId],
    final: {
      actions: [
        { actionType: 'deleteDoc', actionPayload: { docId: empty.docId } },
        {
          actionType: 'modifyDoc',
          actionPayload: {
            docId: best.docId,
            mods: [{
              modType: 'editNote',
              modPayload: { docContent: 'Best kinds of donuts:\n- Chocolate\n- Glazed\n- Only from Krispy Kreme in the area\n\nCrunchier the better.' },
            }],
          },
        },
      ],
    },
  }))

  examples.push(example({
    id: 'failure-create-polished-donut-note-no-tool',
    title: 'Create a polished note from messy user wording without unnecessary tool use',
    category: 'failure-fix/create-note-polish',
    user: 'make doc for best kinds of donuts, a note not list, chocolate, glazed, only from Krispy Kreme around here, and say crunchier the better',
    documents: backgrounds(660, 'Bakery'),
    final: {
      actions: [{
        actionType: 'createDoc',
        actionPayload: {
          docTitle: 'Best Kinds of Donuts',
          docSummary: 'Favorite donut types and preferences.',
          docType: 'note',
          docContent: 'Best kinds of donuts:\n- Chocolate\n- Glazed\n- Only from Krispy Kreme around here\n\nCrunchier the better.',
          docTags: ['food'],
        },
      }],
    },
  }))
}

{
  const banana = note(230, 'Banana Liking', 'Short note about banana preferences.', ['food'], '')
  examples.push(example({
    id: 'failure-add-to-empty-existing-note',
    title: 'Add to an existing empty note instead of creating a duplicate',
    category: 'failure-fix/modify-empty-note',
    user: 'add to banana liking that I like them peeled',
    documents: [banana, ...backgrounds(690, 'Fruit')],
    toolDocIds: [banana.docId],
    final: {
      actions: [{
        actionType: 'modifyDoc',
        actionPayload: {
          docId: banana.docId,
          mods: [{ modType: 'editNote', modPayload: { docContent: 'I like bananas peeled.' } }],
        },
      }],
    },
  }))
}

{
  const spring = list(250, 'Spring Prep', 'Prep checklist for spring.', ['home'], [item(90, 'clean gutters'), item(91, 'check garden soil'), item(92, 'test irrigation')])
  const summer = list(251, 'Summer Prep', 'Empty prep checklist for summer.', ['home'], [])
  const fall = list(252, 'Fall Prep', 'Empty prep checklist for fall.', ['home'], [])
  const winter = list(253, 'Winter Prep', 'Empty prep checklist for winter.', ['home'], [])
  examples.push(example({
    id: 'failure-use-source-doc-for-new-season-docs',
    title: 'Use source doc inspiration before creating related docs',
    category: 'failure-fix/source-doc-create-many',
    user: 'add items to the 3 season prep docs that are empty, but first look at the spring one for inspiration on item type',
    documents: [spring, summer, fall, winter, ...backgrounds(720, 'Season')],
    toolDocIds: [spring.docId, summer.docId, fall.docId, winter.docId],
    final: {
      actions: [
        { actionType: 'modifyDoc', actionPayload: { docId: summer.docId, mods: [{ modType: 'addListItem', modPayload: { itemContent: 'service AC', itemCompleted: false } }, { modType: 'addListItem', modPayload: { itemContent: 'check fans', itemCompleted: false } }, { modType: 'addListItem', modPayload: { itemContent: 'water plants deeply', itemCompleted: false } }] } },
        { actionType: 'modifyDoc', actionPayload: { docId: fall.docId, mods: [{ modType: 'addListItem', modPayload: { itemContent: 'rake leaves', itemCompleted: false } }, { modType: 'addListItem', modPayload: { itemContent: 'inspect heater', itemCompleted: false } }, { modType: 'addListItem', modPayload: { itemContent: 'seal window gaps', itemCompleted: false } }] } },
        { actionType: 'modifyDoc', actionPayload: { docId: winter.docId, mods: [{ modType: 'addListItem', modPayload: { itemContent: 'cover outdoor faucets', itemCompleted: false } }, { modType: 'addListItem', modPayload: { itemContent: 'stock ice melt', itemCompleted: false } }, { modType: 'addListItem', modPayload: { itemContent: 'check blankets', itemCompleted: false } }] } },
      ],
    },
  }))

  examples.push(example({
    id: 'failure-edit-four-season-docs-with-multiple-tools',
    title: 'Fetch and edit multiple season docs in one request',
    category: 'failure-fix/multi-tool-multi-modify',
    user: 'for each season doc add an item called general season reminder for sunblock',
    documents: [spring, summer, fall, winter, ...backgrounds(750, 'Reminder')],
    toolDocIds: [spring.docId, summer.docId, fall.docId, winter.docId],
    final: {
      actions: [spring, summer, fall, winter].map((seasonDoc) => ({
        actionType: 'modifyDoc',
        actionPayload: {
          docId: seasonDoc.docId,
          mods: [{ modType: 'addListItem', modPayload: { itemContent: 'general season reminder for sunblock', itemCompleted: false } }],
        },
      })),
    },
  }))

  const springWithP = list(254, 'Spring Prep', 'Prep checklist for spring.', ['home'], [item(93, 'plant herbs'), item(94, 'clean gutters'), item(95, 'power wash patio'), item(96, 'test irrigation')])
  examples.push(example({
    id: 'failure-delete-list-items-by-prefix',
    title: 'Remove matching list items after fetching the list',
    category: 'failure-fix/list-filter-delete',
    user: 'remove from spring prep doc any item that starts with p',
    documents: [springWithP, summer, fall, winter, ...backgrounds(780, 'Garden')],
    toolDocIds: [springWithP.docId],
    final: {
      actions: [{
        actionType: 'modifyDoc',
        actionPayload: {
          docId: springWithP.docId,
          mods: [
            { modType: 'deleteListItem', modPayload: { itemId: shortId(9093) } },
            { modType: 'deleteListItem', modPayload: { itemId: shortId(9095) } },
          ],
        },
      }],
    },
  }))

  const updated = list(255, 'Spring Prep List - Updated', 'Empty accidental updated spring prep duplicate.', ['home'], [])
  examples.push(example({
    id: 'failure-delete-updated-duplicate-not-original',
    title: 'Delete the specifically named updated duplicate, not the original',
    category: 'failure-fix/delete-specific-duplicate',
    user: 'delete the updated spring one',
    documents: [spring, updated, summer, fall, winter, ...backgrounds(810, 'Cleanup')],
    final: { actions: [{ actionType: 'deleteDoc', actionPayload: { docId: updated.docId } }] },
  }))
}

{
  const hrSpring = list(270, 'HR Spring Prep', 'Spring prep list for HR planning.', ['work', 'hr'], [item(110, 'confirm onboarding dates'), item(111, 'review benefits calendar')])
  examples.push(example({
    id: 'failure-single-edit-fetch-once-then-final',
    title: 'Single-document edit fetches once and then finalizes',
    category: 'failure-fix/no-repeat-tool',
    user: 'edit hr spring doc to add 3-5 good things to prep',
    documents: [note(271, 'Spring Hiring Notes', 'Hiring notes for the spring cycle.', ['work'], 'Open roles:\n- Support lead\n- Operations coordinator'), ...backgrounds(840, 'Office'), hrSpring],
    toolDocIds: [hrSpring.docId],
    final: {
      actions: [{
        actionType: 'modifyDoc',
        actionPayload: {
          docId: hrSpring.docId,
          mods: [
            { modType: 'addListItem', modPayload: { itemContent: 'prepare manager talking points', itemCompleted: false } },
            { modType: 'addListItem', modPayload: { itemContent: 'draft onboarding checklist updates', itemCompleted: false } },
            { modType: 'addListItem', modPayload: { itemContent: 'schedule benefits reminder email', itemCompleted: false } },
            { modType: 'addListItem', modPayload: { itemContent: 'review seasonal staffing needs', itemCompleted: false } },
          ],
        },
      }],
    },
  }))

  const springPrep = list(272, 'Spring Prep List', 'Spring preparation checklist.', ['home'], [item(112, 'old reminder to replace'), item(113, 'clean gutters'), item(114, 'check garden soil')])
  examples.push(example({
    id: 'failure-delete-first-and-add-range-items',
    title: 'Delete first item and expand a 3-5 range into concrete list items',
    category: 'failure-fix/range-items-and-delete',
    user: 'delete the first item of spring prep list, and then add 3-5 good things to actually prep for spring in there',
    documents: [note(273, 'Spring Ideas', 'Loose spring ideas.', ['home'], 'Maybe repaint the porch later.'), ...backgrounds(870, 'Yard'), springPrep],
    toolDocIds: [springPrep.docId],
    final: {
      actions: [{
        actionType: 'modifyDoc',
        actionPayload: {
          docId: springPrep.docId,
          mods: [
            { modType: 'deleteListItem', modPayload: { itemId: shortId(9112) } },
            { modType: 'addListItem', modPayload: { itemContent: 'test irrigation system', itemCompleted: false } },
            { modType: 'addListItem', modPayload: { itemContent: 'wash outdoor furniture', itemCompleted: false } },
            { modType: 'addListItem', modPayload: { itemContent: 'inspect window screens', itemCompleted: false } },
            { modType: 'addListItem', modPayload: { itemContent: 'refresh garden supplies', itemCompleted: false } },
          ],
        },
      }],
    },
  }))
}

const dataset = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf8'))
const byId = new Map(examples.map((entry) => [entry.id, entry]))

dataset.promptTemplate = developerPromptTemplate
dataset.examples = [
  ...dataset.examples.filter((entry) => !byId.has(entry.id)),
  ...examples,
]

const validation = validateDataset(dataset)
if (validation.errors.length) {
  console.error(validation.errors.join('\n'))
  process.exit(1)
}

fs.writeFileSync(DATASET_PATH, `${JSON.stringify(dataset, null, 2)}\n`)
console.log(`Added/updated ${examples.length} draft failure-fix examples.`)
