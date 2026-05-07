import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY,
});

const QUERY_MEMORY_MODEL = process.env.QUERY_MEMORY_MODEL || "gpt-4.1-mini";
const ASK_MEMORY_MODEL = process.env.ASK_MEMORY_MODEL || "gpt-4.1-mini";
const MAX_DOCUMENT_FETCHES = 5;

const DEBUG_AI = true;

function logAI(label, obj = null) {
    if (!DEBUG_AI) return;
    const ts = new Date().toISOString().slice(11, 23);
    if (obj === null) console.log(`[AI ${ts}] ${label}`);
    else console.log(`[AI ${ts}] ${label}`, obj);
}

const PocketMemoryJSONTools = [
    {
        type: "function",
        name: "get_docs",
        description: "Retrieve one or more full documents by id, including all content, tags, and metadata.",
        strict: true,
        parameters: {
            type: "object",
            properties: {
                docIds: {
                    type: "array",
                    minItems: 1,
                    maxItems: MAX_DOCUMENT_FETCHES,
                    description: "Unique short document ids to retrieve, including full content and metadata.",
                    items: { type: "string" }
                }
            },
            required: [
                "docIds"
            ],
            additionalProperties: false
        }
    }
];

function toToolListItem(item) {
    if (typeof item === "string") {
        return {
            itemId: "",
            itemContent: item,
            itemCompleted: false,
        };
    }

    return {
        itemId: item?.itemId || item?.id || "",
        itemContent: item?.itemContent ?? item?.content ?? "",
        itemCompleted: Boolean(item?.itemCompleted ?? item?.completed ?? false),
    };
}

function toToolDocContent(doc) {
    if ((doc?.docType ?? doc?.type) === "list") {
        return Array.isArray(doc?.docContent ?? doc?.content)
            ? (doc.docContent ?? doc.content).map(toToolListItem)
            : [];
    }

    return doc?.docContent ?? doc?.content ?? "";
}

const PocketMemoryJSONSchema = {
    type: "object",
    additionalProperties: false,
    required: ["actions"],
    properties: {
        actions: {
            type: "array",
            minItems: 0,
            items: {
                anyOf: [
                    // ---------- createDoc ----------
                    {
                        type: "object",
                        additionalProperties: false,
                        required: ["actionType", "actionPayload"],
                        properties: {
                            actionType: {
                                type: "string",
                                enum: ["createDoc"],
                                description: "Create a new document."
                            },
                            actionPayload: {
                                anyOf: [
                                    // NOTE
                                    {
                                        type: "object",
                                        additionalProperties: false,
                                        required: ["docTitle", "docSummary", "docType", "docContent", "docTags"],
                                        properties: {
                                            docTitle: {
                                                type: "string",
                                                description:
                                                    "Short human-friendly title for the new document. Must be unique (app will enforce)."
                                            },
                                            docSummary: {
                                                type: "string",
                                                description: "Concise one-sentence summary of the document."
                                            },
                                            docType: {
                                                type: "string",
                                                enum: ["note"],
                                                description: "Document type."
                                            },
                                            docContent: {
                                                type: "string",
                                                description: "Full initial content of the document."
                                            },
                                            // Optional now, easy to expand later:
                                            docTags: {
                                                type: "array",
                                                description: "Optional tags for organizing documents.",
                                                minItems: 0,
                                                maxItems: 3,
                                                items: { type: "string" }
                                            }
                                            // docMetadata: {
                                            //     type: "object",
                                            //     additionalProperties: false,
                                            //     required: ["language"],
                                            //     properties: {
                                            //         language: {
                                            //             type: "string",
                                            //             enum: ["en", "es", "fr", "de", "it", "pt", "ru", "ja", "zh", "ko"],
                                            //             description:
                                            //                 "Language of the document."
                                            //         }
                                            //     }
                                            // }
                                        }
                                    },

                                    // LIST
                                    {
                                        type: "object",
                                        additionalProperties: false,
                                        required: ["docTitle", "docSummary", "docType", "docTags", "docContent", "docMetadata"],
                                        properties: {
                                            docTitle: {
                                                type: "string",
                                                description:
                                                    "Short human-friendly title for the new document. Must be unique (app will enforce)."
                                            },
                                            docSummary: {
                                                type: "string",
                                                description: "Concise one-sentence summary of the document."
                                            },
                                            docType: {
                                                type: "string",
                                                enum: ["list"],
                                                description: "Document type."
                                            },
                                            docTags: {
                                                type: "array",
                                                description: "Optional tags for organizing documents.",
                                                minItems: 0,
                                                maxItems: 3,
                                                items: { type: "string" }
                                            },
                                            docContent: {
                                                type: "array",
                                                description: "Initial items of the list document.",
                                                items: { type: "string" }
                                            },
                                            docMetadata: {
                                                type: "object",
                                                additionalProperties: false,
                                                required: ["listType"],
                                                properties: {
                                                    listType: {
                                                        type: "string",
                                                        enum: ["normal", "grocery"],
                                                        description:
                                                            "Type of list, either normal or specific to a grocery or store list."
                                                    }
                                                }
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    },

                    // ---------- deleteDoc ----------
                    {
                        type: "object",
                        additionalProperties: false,
                        required: ["actionType", "actionPayload"],
                        properties: {
                            actionType: {
                                type: "string",
                                enum: ["deleteDoc"],
                                description: "Delete an existing document by id."
                            },
                            actionPayload: {
                                type: "object",
                                additionalProperties: false,
                                required: ["docId"],
                                properties: {
                                    docId: {
                                        type: "string",
                                        description: "Short id of the document to delete."
                                    }
                                }
                            }
                        }
                    },

                    // ---------- openDoc ----------
                    {
                        type: "object",
                        additionalProperties: false,
                        required: ["actionType", "actionPayload"],
                        properties: {
                            actionType: {
                                type: "string",
                                enum: ["openDoc"],
                                description:
                                    "Open an existing document for the user to view and/or edit."
                            },
                            actionPayload: {
                                type: "object",
                                additionalProperties: false,
                                required: ["docId"],
                                properties: {
                                    docId: {
                                        type: "string",
                                        description: "Short id of the document to open."
                                    }
                                }
                            }
                        }
                    },

                    // ---------- modifyDoc ----------
                    {
                        type: "object",
                        additionalProperties: false,
                        required: ["actionType", "actionPayload"],
                        properties: {
                            actionType: {
                                type: "string",
                                enum: ["modifyDoc"],
                                description:
                                    "Apply one or more mods to an existing document."
                            },
                            actionPayload: {
                                type: "object",
                                additionalProperties: false,
                                required: ["docId", "mods"],
                                properties: {
                                    docId: {
                                        type: "string",
                                        description: "Short id of the document to modify."
                                    },

                                    mods: {
                                        type: "array",
                                        minItems: 1,
                                        description:
                                            "One or more document mods to apply in order.",
                                        items: {
                                            anyOf: [
                                                // addListItem
                                                {
                                                    type: "object",
                                                    additionalProperties: false,
                                                    required: ["modType", "modPayload"],
                                                    properties: {
                                                        modType: {
                                                            type: "string",
                                                            enum: ["addListItem"],
                                                            description:
                                                                "Add a new item to a list document."
                                                        },
                                                        modPayload: {
                                                            type: "object",
                                                            additionalProperties: false,
                                                            required: ["itemContent", "itemCompleted"],
                                                            properties: {
                                                                itemCompleted: {
                                                                    type: "boolean",
                                                                    description:
                                                                        "Whether the new list item is completed."
                                                                },
                                                                itemContent: {
                                                                    type: "string",
                                                                    description:
                                                                        "The full text for the new list item. This becomes the item's entire content. Must not be empty."
                                                                }
                                                            }
                                                        }
                                                    }
                                                },


                                                // editListItem
                                                {
                                                    type: "object",
                                                    additionalProperties: false,
                                                    required: ["modType", "modPayload"],
                                                    properties: {
                                                        modType: {
                                                            type: "string",
                                                            enum: ["editListItem"],
                                                            description:
                                                                "Replace the content of an existing list item."
                                                        },
                                                        modPayload: {
                                                            type: "object",
                                                            additionalProperties: false,
                                                            required: ["itemId", "itemContent", "itemCompleted"],
                                                            properties: {
                                                                itemId: {
                                                                    type: "string",
                                                                    description:
                                                                        "The itemId from the get_docs docContent item to edit."
                                                                },
                                                                itemCompleted: {
                                                                    type: "boolean",
                                                                    description:
                                                                        "Whether the list item is completed."
                                                                },
                                                                itemContent: {
                                                                    type: "string",
                                                                    description:
                                                                        "Replaces the item's entire previous content (not a patch). Keep the meaning, apply the edits, and output the final full text. Must not be empty."
                                                                }
                                                            }
                                                        }
                                                    }
                                                },

                                                // deleteListItem
                                                {
                                                    type: "object",
                                                    additionalProperties: false,
                                                    required: ["modType", "modPayload"],
                                                    properties: {
                                                        modType: {
                                                            type: "string",
                                                            enum: ["deleteListItem"],
                                                            description:
                                                                "Delete a list item completely (not just mark it as completed, only use this if the item should be truly deleted forever ie. from an error)."
                                                        },
                                                        modPayload: {
                                                            type: "object",
                                                            additionalProperties: false,
                                                            required: ["itemId"],
                                                            properties: {
                                                                itemId: {
                                                                    type: "string",
                                                                    description:
                                                                        "The itemId from the get_docs docContent item to delete."
                                                                }
                                                            }
                                                        }
                                                    }
                                                },

                                                // editNote (replace full content)
                                                {
                                                    type: "object",
                                                    additionalProperties: false,
                                                    required: ["modType", "modPayload"],
                                                    properties: {
                                                        modType: {
                                                            type: "string",
                                                            enum: ["editNote"],
                                                            description:
                                                                "Replace the full content of a note document."
                                                        },
                                                        modPayload: {
                                                            type: "object",
                                                            additionalProperties: false,
                                                            required: ["docContent"],
                                                            properties: {
                                                                docContent: {
                                                                    type: "string",
                                                                    description:
                                                                        "Full updated note content (entire doc). Keep/repeat all existing content and simply apply the requested edits; output the final full text to replace old content."
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    }
                ]
            }
        }
    }
};

export async function* openaiApi(input, documents = [], stream = false) {
    const messages = Array.isArray(input)
        ? input
        : [{ role: "user", content: input }];

    const contextString = documents.length > 0
        ? `\n\n${documents.map(d => {
            const listType = d.listType || d.docMetadata?.listType;
            const tags = d.docTags || d.tags;
            return `- \`[${d.docId || d.id}] ${d.docTitle || d.title}: ${d.docSummary || d.summary}\` (${d.docType || d.type}${listType ? ` - ${listType}` : ""})${tags?.length ? ` [${tags.join(", ")}]` : ""}`;
        }).join('\n')}`
        : '';

    const memoryDeveloperContent = `# Role and Objective
You are "Pocket Memory", a second-brain assistant that translates a single user message into specific app actions.

Your responsibility is to interpret the user's latest message and decide what, if anything, the app should do in response.

---

# Instructions
- If the user types complete gibberish, or has absolutely no clear intent, do not output any actions.
- Attempt to understand intent even with spelling mistakes or unclear phrasing.
- Respond with clear, confident app actions.
- Prefer existing documents when at all possible.
- Editing an existing matching document is higher priority than creating a new one.
- Only create a new document if none is clearly suitable, or if the user explicitly asks for a new/separate document.
- Avoid duplicates.
- Do not hallucinate document edits or IDs.
- Use only docIds that appear verbatim in the provided Existing documents list. Never invent, shorten, transform, or guess a docId.
- If the user gives an actionable instruction, make a careful best judgment rather than dropping the request.
- Only do nothing for gibberish, obvious testing, playful typing, or truly impossible/harmful ambiguity.

You will be given:
1) The user’s message.
2) A list of the user’s existing documents (each has: \`[docId] docTitle: docSummary\` (docType - listType sometimes) [optional docTags]).

The document list is for selection only — it does NOT contain document content.

---

## Core Action Types
- **createDoc**  
  Create a new document to capture new, reusable information that does not clearly belong in an existing document.

- **openDoc**  
  Open an existing document only when the user asks to open, show, view, pull up, inspect, or asks what's on a named list/document in capture mode. Do not add openDoc after create/modify/delete unless the user explicitly asks to open it.
  - "open my grocery list"
  - "show my notes about donuts"
  - "pull up that packing list"

- **modifyDoc**  
  Change an existing document when the user gives edits such as:
  - "add chocolate donuts"
  - "mark milk as done"
  - "change the note to say..."
  - "remove that last item"

- **deleteDoc**  
  Delete a whole document ONLY when deletion is explicit and unambiguous. If the user says delete/remove a word, item, typo, random text, or part of a document, that is modifyDoc, not deleteDoc.

---

## Document Selection
When an action involves a document:
1) Match by exact or similar title first (case-insensitive).
2) Then match by summary, document type, list type, tags, pinned/visible ordering, or practical everyday intent.
3) If a user says "the list" and there is one grocery list, prefer that grocery list.
4) If the request mentions an existing title/topic and the document list contains a close match, prefer modifying/opening/deleting that existing document over creating a duplicate.
5) If multiple documents could apply and confidence is low, do NOT modify/delete anything.

---

## High-Level Decision Flow (important)

### Step 1: Decide what the user wants
- Open / view something → openDoc
- Delete something → deleteDoc
- Edit existing content → modifyDoc
- Capture new info → createDoc
- No clear intent and no relation at all to any documents → no actions

If one user message asks for multiple independent actions, output every requested action in the same final response.

If the user gives a count or range such as "3-5 things", create that many concrete useful items. Do not add a literal item whose text is "3-5 things".

### Step 2: Decide whether document content is required
- openDoc / createDoc / deleteDoc  
  → Usually do NOT retrieve document content when the visible document list is enough.
- modifyDoc  
  → Document content IS required.

### Step 3: If mod is requested, check if you already have docContent
You ONLY have docContent if a **get_docs tool output** for that docId appears in the current input.

The "Existing documents" list does NOT count as docContent.
The get_docs output is authoritative and contains full document content for every returned docId.
For list documents, get_docs returns docContent items as { itemId, itemContent, itemCompleted }. Always use itemId from that output when editing or deleting existing list items.

Timeline for edits:
1) First turn: choose all docIds that truly need content and call get_docs once with a docIds array.
2) After tool output: read that docContent, then output final modifyDoc actions.
3) Never call get_docs again for a docId that already has a tool output.

---

## Content-Gated Actions
You may ONLY output a modifyDoc action if you already have the full docContent for that exact docId available in the current input.
You may also use get_docs for other actions when the user explicitly asks for work that truly depends on hidden document content.

If the user wants to modify a document, or otherwise needs hidden document content, and you do NOT yet have docContent:
- Call get_docs with the single best-matching docId in the docIds array.
- Do not output app actions in the same response as a tool call.
- Stop after the tool call unless the API later returns the tool output; after tool output, either fetch another required unique document or output the final actions.

Empty docContent is still valid docContent. Do not call get_docs again just because it is empty.

You will be run again after tool output is provided, and ONLY then should you output modifyDoc actions for fetched documents.

If you cannot confidently determine which document to edit, do nothing.

---

## Tool Use: get_docs
- Call get_docs only when the next correct step truly needs full document content.
- Usually do not call get_docs for open/show/view/create/delete when the visible document list is enough.
- Usually one get_docs call is enough.
- If the user asks to edit one document, call get_docs exactly once with that one docId, then output the final modifyDoc action.
- Include multiple different docIds in one get_docs call only when one user request truly requires content from several documents, such as editing several docs or using one doc as source material for new docs.
- Do not fetch multiple documents for a one-document edit.
- Never request the same docId more than once in one user message.
- Every docId passed to get_docs must be copied exactly from the Existing documents list. If no listed docId confidently matches the user's target, output no actions instead of calling get_docs.
- A get_docs output is the complete document set for those docIds, even if a document is empty or surprising.
- After each get_docs output, either fetch any still-required unique documents or produce the final JSON actions.
- If docContent for a docId is already present in the input, reuse it.
- Do not re-request documents or enter loops.

---

## Mods
When outputting modifyDoc:
- Always include the docId.
- Always include an ordered array of mods.
- All edits must be based strictly on the provided docContent.

### For list documents:
- **addListItem**: add a new item (usually itemCompleted = false).
- **editListItem**: replace the entire content/completed state of an existing item using itemId from get_docs.
- **deleteListItem**: permanently remove an item using itemId from get_docs (use sparingly).

### For note documents:
- **editNote** replaces the ENTIRE document content.
- Only use editNote when the full existing content is known from get_docs.
- Do not guess or partially rewrite notes.
- If a note contains hashtags, bullets, lines, or paragraphs, still use editNote. Never use addListItem/editListItem/deleteListItem on a note.

---

## Output Hygiene
- Return a single JSON object with an "actions" array.
- Do not include extra text.
- Keep items concise and preserve user wording.
- Clean obvious spelling/typing mistakes when creating polished notes, but preserve the user's intended meaning and specific details.
- Do not add openDoc after another action unless explicitly requested.

---

## Constraints
- Never invent docIds or itemIds.
- Do not make redundant or near-duplicate documents.
- Create a new document when the user explicitly says "new" or "separate", even if a similar one exists.

---

# Context
Existing documents:
${contextString}`;

    const chatDeveloperContent = `You are "Pocket Memory", a second-brain assistant that uses the provided memory and chat history to quickly and accurately respond to the user. Keep answers concise and conversational, and always fully accurate to the context and memory provided, without hallucinating information.

# Context
Existing documents:
${contextString}`;

    if (stream) {
        const chatStream = await openai.responses.create({
            model: ASK_MEMORY_MODEL,
            input: [
                { role: "developer", content: chatDeveloperContent },
                ...messages
            ],
            stream: true,
        });
        for await (const chunk of chatStream) {
            yield chunk;
        }
        return;
    }

    try {
        function safeJsonParse(str) {
            try { return JSON.parse(str); } catch { return null; }
        }

        function sanitizeForInput(item) {
            if (item?.type === "function_call") {
                return {
                    type: "function_call",
                    call_id: item.call_id,
                    name: item.name,
                    arguments: item.arguments,
                };
            }

            if (item?.type === "function_call_output") {
                return {
                    type: "function_call_output",
                    call_id: item.call_id,
                    output: item.output,
                };
            }

            // normal chat message objects already look like { role, content }
            if (item?.role) return item;

            // fallback: don't forward unknown shapes
            return null;
        }

        function getDocumentForTool(doc) {
            if (!doc) return null;

            return {
                docId: doc.docId ?? doc.id ?? "",
                docTitle: doc.docTitle ?? doc.title ?? "",
                docSummary: doc.docSummary ?? doc.summary ?? "",
                docType: doc.docType ?? doc.type ?? "",
                docTags: doc.docTags ?? doc.tags ?? [],
                docMetadata: doc.docMetadata ?? {},
                docContent: toToolDocContent(doc),
            };
        }

        async function* sendOpenAIRequest(initialInputs) {
            const startedAt = Date.now();
            logAI("send.start", {
                last: initialInputs[initialInputs.length - 1],
            });
            const fetchedDocIds = new Set();
            let inputs = [...initialInputs];
            let forceDisableTools = false;

            for (let depth = 0; depth < 8; depth++) {
                if (depth > 4) forceDisableTools = true;
                const canGetDocuments = !forceDisableTools && fetchedDocIds.size < MAX_DOCUMENT_FETCHES;

                if (depth > 4) {
                    logAI("WARNING: depth high (possible loop)", { depth });
                }
                logAI("model.SEND_FULL", inputs);

                const requestInput = [
                    { role: "developer", content: memoryDeveloperContent },
                    ...inputs
                ];

                const modelStartedAt = Date.now();
                const response = await openai.responses.parse({
                    model: QUERY_MEMORY_MODEL,
                    store: false,
                    tools: canGetDocuments ? PocketMemoryJSONTools : [],
                    tool_choice: canGetDocuments ? "auto" : "none",
                    parallel_tool_calls: false,
                    input: requestInput,
                    max_output_tokens: 1800,
                    text: {
                        format: {
                            type: "json_schema",
                            name: "second_brain",
                            strict: true,
                            schema: PocketMemoryJSONSchema,
                        },
                    },
                });
                const modelMs = Date.now() - modelStartedAt;

                logAI("model.output.types", { depth, modelMs, types: response.output?.map(o => o.type) });

                const toolCalls = response.output?.filter(o => o.type === "function_call") || [];
                if (toolCalls.length === 0) {
                    if (!response.output_parsed) throw new Error("No structured JSON output returned.");
                    logAI("final.actions", response.output_parsed);
                    yield {
                        type: "final",
                        data: response.output_parsed,
                        meta: {
                            depth,
                            modelMs,
                            totalMs: Date.now() - startedAt,
                            fetchedDocCount: fetchedDocIds.size,
                        },
                    };
                    return;
                }

                // Append the tool call(s) and tool output(s) to inputs
                for (const call of toolCalls) {
                    logAI("tool.call", {
                        name: call.name,
                        call_id: call.call_id,
                        arguments: safeJsonParse(call.arguments),
                    });

                    if (call.name === "get_docs") {

                        const args = safeJsonParse(call.arguments);
                        const requestedDocIds = Array.isArray(args?.docIds) ? args.docIds.filter(Boolean) : [];
                        const uniqueDocIds = [...new Set(requestedDocIds)].slice(0, MAX_DOCUMENT_FETCHES);
                        const freshDocIds = uniqueDocIds.filter((docId) => !fetchedDocIds.has(docId));
                        inputs.push(sanitizeForInput(call));

                        if (uniqueDocIds.length === 0) {
                            yield {
                                type: "debug",
                                step: "tool.get_docs.denied",
                                details: {
                                    reason: "missing_doc_ids",
                                    requestedDocIds,
                                    modelMs,
                                    totalMs: Date.now() - startedAt,
                                },
                            };
                            inputs.push({
                                type: "function_call_output",
                                call_id: call.call_id,
                                output: JSON.stringify({ success: false, error: "Missing docIds." }),
                            });
                            forceDisableTools = true;
                            continue;
                        }

                        if (freshDocIds.length === 0) {
                            logAI("docIds already cached, skipping", { docIds: uniqueDocIds });
                            yield {
                                type: "debug",
                                step: "tool.get_docs.denied",
                                details: {
                                    reason: "already_fetched",
                                    requestedDocIds,
                                    docIds: uniqueDocIds,
                                    modelMs,
                                    totalMs: Date.now() - startedAt,
                                },
                            };
                            inputs.push({
                                type: "function_call_output",
                                call_id: call.call_id,
                                output: JSON.stringify({
                                    success: false,
                                    error: "All requested documents were already fetched for this user message. Earlier function_call_output items contain the full documents. Do not call get_docs again for those ids; produce final JSON actions now.",
                                    docIds: uniqueDocIds,
                                }),
                            });
                            forceDisableTools = true;
                            continue;
                        }

                        const results = freshDocIds.map((docId) => {
                            const fetched = documents.find((doc) => doc.docId === docId);
                            const toolDocument = getDocumentForTool(fetched);
                            const docContent = toolDocument?.docContent ?? "";
                            const docTitle = toolDocument?.docTitle || "a document";

                            logAI("tool.get_docs.result", {
                                docId,
                                found: Boolean(fetched),
                                docTitle,
                                contentType: Array.isArray(docContent) ? "list" : typeof docContent,
                                contentLength: Array.isArray(docContent) ? docContent.length : String(docContent || "").length,
                            });

                            return toolDocument
                                ? { success: true, document: toolDocument }
                                : { success: false, error: "Document not found.", docId };
                        });

                        const documentsOut = results
                            .filter((result) => result.success && result.document)
                            .map((result) => result.document);
                        const missingDocIds = results
                            .filter((result) => !result.success)
                            .map((result) => result.docId);
                        const toolOutput = JSON.stringify({
                            success: documentsOut.length > 0,
                            documents: documentsOut,
                            missingDocIds,
                        });
                        const firstDoc = documentsOut[0];
                        const firstContent = firstDoc?.docContent ?? "";
                        const docTitles = documentsOut.map((doc) => doc.docTitle).filter(Boolean);

                        yield {
                            type: "debug",
                            step: "tool.get_docs",
                            details: {
                                docIds: freshDocIds,
                                docTitles,
                                foundCount: documentsOut.length,
                                missingDocIds,
                                contentType: Array.isArray(firstContent) ? "list" : typeof firstContent,
                                contentLength: Array.isArray(firstContent) ? firstContent.length : String(firstContent || "").length,
                                modelMs,
                                totalMs: Date.now() - startedAt,
                                output: safeJsonParse(toolOutput),
                            },
                        };

                        // Yield progress update
                        yield {
                            type: "progress",
                            message: `Scanning ${docTitles[0] || "documents"}...`,
                            docId: freshDocIds[0],
                            docTitle: docTitles.length > 1 ? `${docTitles[0]} +${docTitles.length - 1} more` : docTitles[0],
                        };

                        inputs.push({
                            type: "function_call_output",
                            call_id: call.call_id,
                            output: toolOutput,
                        });
                        freshDocIds.forEach((docId) => fetchedDocIds.add(docId));
                    } else {
                        yield {
                            type: "debug",
                            step: "tool.denied",
                            details: {
                                reason: "unhandled_tool",
                                name: call.name,
                                callId: call.call_id,
                                arguments: safeJsonParse(call.arguments),
                                modelMs,
                                totalMs: Date.now() - startedAt,
                            },
                        };
                        inputs.push(sanitizeForInput(call));
                        inputs.push({
                            type: "function_call_output",
                            call_id: call.call_id,
                            output: JSON.stringify({ success: false, error: `Unhandled tool: ${call.name}` }),
                        });
                        forceDisableTools = true;
                    }
                }
            }

            throw new Error("Maximum tool loop iterations exceeded.");
        }

        const generator = sendOpenAIRequest(messages);
        for await (const chunk of generator) {
            yield chunk;
        }
    }
    catch (error) {
        console.error("AI network Error:", error);
        throw error;
    }
}
