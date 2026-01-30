import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY,
});

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
        name: "get_document",
        description: "Retrieve a full document by its unique identifier, including all content, tags, and metadata.",
        strict: true,
        parameters: {
            type: "object",
            properties: {
                docId: {
                    type: "string",
                    description: "The unique UUID of the document to retrieve, including its full content and all metadata."
                }
            },
            required: [
                "docId"
            ],
            additionalProperties: false
        }
    }
];

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
                    // ---------- createDocument ----------
                    {
                        type: "object",
                        additionalProperties: false,
                        required: ["actionType", "actionPayload"],
                        properties: {
                            actionType: {
                                type: "string",
                                enum: ["createDocument"],
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

                    // ---------- deleteDocument ----------
                    {
                        type: "object",
                        additionalProperties: false,
                        required: ["actionType", "actionPayload"],
                        properties: {
                            actionType: {
                                type: "string",
                                enum: ["deleteDocument"],
                                description: "Delete an existing document by id."
                            },
                            actionPayload: {
                                type: "object",
                                additionalProperties: false,
                                required: ["docId"],
                                properties: {
                                    docId: {
                                        type: "string",
                                        format: "uuid",
                                        description: "UUID of the document to delete."
                                    }
                                }
                            }
                        }
                    },

                    // ---------- openDocument ----------
                    {
                        type: "object",
                        additionalProperties: false,
                        required: ["actionType", "actionPayload"],
                        properties: {
                            actionType: {
                                type: "string",
                                enum: ["openDocument"],
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
                                        format: "uuid",
                                        description: "UUID of the document to open."
                                    }
                                }
                            }
                        }
                    },

                    // ---------- modifyDocument ----------
                    {
                        type: "object",
                        additionalProperties: false,
                        required: ["actionType", "actionPayload"],
                        properties: {
                            actionType: {
                                type: "string",
                                enum: ["modifyDocument"],
                                description:
                                    "Apply one or more modifications to an existing document."
                            },
                            actionPayload: {
                                type: "object",
                                additionalProperties: false,
                                required: ["docId", "modifications"],
                                properties: {
                                    docId: {
                                        type: "string",
                                        format: "uuid",
                                        description: "UUID of the document to modify."
                                    },

                                    modifications: {
                                        type: "array",
                                        minItems: 1,
                                        description:
                                            "One or more document modifications to apply in order.",
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
                                                                    format: "uuid",
                                                                    description:
                                                                        "UUID of the list item to edit."
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
                                                                    format: "uuid",
                                                                    description:
                                                                        "UUID of the list item to delete."
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
        ? `\n\n${documents.map(d =>
            `- \`[${d.docId || d.id}] ${d.docTitle || d.title}: ${d.docSummary || d.summary}\` (${d.docType || d.type}${d.listType ? ` - ${d.listType}` : ""})${d.docTags || d.tags ? ` [${(d.docTags || d.tags).join(", ")}]` : ""}`
        ).join('\n')}`
        : '';

    const memorySystemContent = `# Role and Objective
You are "Pocket Memory", a second-brain assistant that translates a single user message into specific app actions.

Your responsibility is to interpret the user's latest message and decide what, if anything, the app should do in response.

---

# Instructions
- If the user types complete gibberish, or has absolutely no clear intent, do not output any actions.
- Attempt to understand intent even with spelling mistakes or unclear phrasing.
- Respond with clear, confident app actions.
- Prefer existing documents when at all possible.
- Only create a new document if none is clearly suitable, or if the user explicitly asks for a new one.
- Avoid duplicates.
- Do not hallucinate document edits or IDs.
- If you are unsure or lack required information, do nothing.

You will be given:
1) The user’s message.
2) A list of the user’s existing documents (each has: \`[docId UUID] docTitle: docSummary\` (docType - listType sometimes) [optional docTags]).

The document list is for selection only — it does NOT contain document content.

---

## Core Action Types
- **createDocument**  
  Create a new document to capture new, reusable information that does not clearly belong in an existing document.

- **openDocument**  
  Open an existing document when the user says things like:
  - "open my grocery list"
  - "show my notes about donuts"
  - "pull up that packing list"

- **modifyDocument**  
  Change an existing document when the user gives edits such as:
  - "add chocolate donuts"
  - "mark milk as done"
  - "change the note to say..."
  - "remove that last item"

- **deleteDocument**  
  Delete a document ONLY when deletion is explicit and unambiguous.

---

## Document Selection
When an action involves a document:
1) Match by exact or similar title first (case-insensitive).
2) Then match by summary or topic.
3) If multiple documents could apply and confidence is low, do NOT modify anything.

---

## High-Level Decision Flow (important)

### Step 1: Decide what the user wants
- Open / view something → openDocument
- Delete something → deleteDocument
- Edit existing content → modifyDocument
- Capture new info → createDocument
- No clear intent and no relation at all to any documents → no actions

### Step 2: Decide whether document content is required
- openDocument / createDocument / deleteDocument  
  → Do NOT retrieve document content.
- modifyDocument  
  → Document content IS required.

### Step 3: If modification is requested, check if you already have docContent
You ONLY have docContent if a **get_document tool output** for that docId appears in the current input.

The "Existing documents" list does NOT count as docContent.

---

## Hard Rule: modifyDocument requires docContent
You may ONLY output a modifyDocument action if you already have the full docContent for that exact docId available in the current input.

If the user wants to modify a document and you do NOT yet have docContent:
- Call get_document for the single best-matching docId.
- Do not output any app actions in that response.
- Stop after the tool call.

Empty docContent is still valid docContent. Do not call get_document again just because it is empty.

You will be run again after the tool output is provided, and ONLY then should you output the final modifyDocument action.

If you cannot confidently determine which document to edit, do nothing.

---

## Tool Use: get_document
- Only call get_document when required for a modification.
- Never call get_document for open/show/view/create/delete.
- Never call get_document more than once for the same docId.
- At most ONE get_document call per user message.
- If docContent for a docId is already present in the input, reuse it.
- Do not re-request documents or enter loops.

---

## Modifications
When outputting modifyDocument:
- Always include the docId.
- Always include an ordered array of modifications.
- All edits must be based strictly on the provided docContent.

### For list documents:
- **addListItem**: add a new item (usually itemCompleted = false).
- **editListItem**: replace the entire content of an existing item.
- **deleteListItem**: permanently remove an item (use sparingly).

### For note documents:
- **editNote** replaces the ENTIRE document content.
- Only use editNote when the full existing content is known from get_document.
- Do not guess or partially rewrite notes.

---

## Output Hygiene
- Return a single JSON object with an "actions" array.
- Do not include extra text.
- Keep items concise and preserve user wording.
- Minimal cleanup only; do not rewrite unless asked.

---

## Constraints
- Never invent docIds or itemIds.
- Do not make redundant or near-duplicate documents.
- Create a new document when the user explicitly says "new" or "separate", even if a similar one exists.

---

# Context
Existing documents:
${contextString}`;

    const chatSystemContent = `You are "Pocket Memory", a second-brain assistant that uses the provided memory and chat history to quickly and accurately respond to the user. Keep answers concise and conversational, and always fully accurate to the context and memory provided, without hallucinating information.

# Context
Existing documents:
${contextString}`;

    if (stream) {
        const chatStream = await openai.responses.create({
            model: "gpt-4o-mini",
            input: [
                { role: "system", content: chatSystemContent },
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

        function buildDocCacheSystemMessage(docCache, canGetDocuments) {
            if (!docCache.size) return null;

            const lines = [];
            lines.push("DOC_CONTENT (authoritative):");
            for (const [docId, entry] of docCache.entries()) {
                const title = entry.docTitle ? ` (${entry.docTitle})` : "";
                // Keep this short so it doesn’t bloat tokens
                const contentText = (entry.docContent || "");
                lines.push(`---- docId=${docId}${title} ----\n"${contentText}"\n---- end docId=${docId}${title} ----`);
            }

            if (canGetDocuments) {
                lines.push("");
                lines.push("Rules:");
                lines.push("- Do NOT call get_document again for any docId listed above.");
                lines.push("- Use the cached docContent above to produce the final JSON actions now.");
                lines.push("- Only call get_document if you need a DIFFERENT docId not in the cache.");
            }

            return { role: "system", content: lines.join("\n") };
        }

        async function* sendOpenAIRequest(initialInputs) {
            logAI("send.start", {
                last: initialInputs[initialInputs.length - 1],
            });
            const docCache = new Map(); // docId -> { docContent, docTitle? }
            let inputs = [...initialInputs];
            let canGetDocuments = true;

            for (let depth = 0; depth < 15; depth++) {
                if (depth > 5) {
                    logAI("WARNING: depth high (possible loop)", { depth });
                    canGetDocuments = false;
                }
                logAI("model.SEND_FULL", inputs);

                const response = await openai.responses.parse({
                    model: "gpt-4o-mini",
                    store: true,
                    tools: canGetDocuments ? PocketMemoryJSONTools : [],
                    input: [
                        { role: "system", content: memorySystemContent },
                        ...inputs
                    ],
                    max_output_tokens: 750,
                    text: {
                        format: {
                            type: "json_schema",
                            name: "second_brain",
                            strict: true,
                            schema: PocketMemoryJSONSchema,
                        },
                    },
                });

                logAI("model.output.types", response.output?.map(o => o.type));

                const toolCalls = response.output?.filter(o => o.type === "function_call") || [];
                if (toolCalls.length === 0) {
                    if (!response.output_parsed) throw new Error("No structured JSON output returned.");
                    logAI("final.actions", response.output_parsed);
                    yield { type: "final", data: response.output_parsed };
                    return;
                }

                // Append the tool call(s) and tool output(s) to inputs
                for (const call of toolCalls) {
                    if (call.name === "get_document") {

                        const args = safeJsonParse(call.arguments);
                        const docId = args?.docId;

                        if (!docId) {
                            inputs.push(sanitizeForInput(call));
                            inputs.push({
                                type: "function_call_output",
                                call_id: call.call_id,
                                output: JSON.stringify({ success: false, error: "Missing docId, you must provide a docId to get a document." }),
                            });
                            continue;
                        }

                        if (docCache.has(docId)) {
                            canGetDocuments = false;
                            logAI("docId already cached, skipping", { docId });
                            continue;
                        }

                        const fetched = documents.find((doc) => doc.docId === docId);
                        const docContent = fetched?.docContent ?? fetched?.content ?? "";
                        const docTitle = fetched?.docTitle ?? fetched?.title ?? "a document";

                        // Yield progress update
                        yield { type: "progress", message: `Scanning ${docTitle}...`, docId, docTitle };

                        docCache.set(docId, {
                            docContent,
                            docTitle: fetched?.docTitle ?? fetched?.title ?? "",
                        });

                        inputs.push(sanitizeForInput(call));
                        inputs.push({
                            type: "function_call_output",
                            call_id: call.call_id,
                            output: JSON.stringify({ success: true, docContent, docTitle: fetched?.docTitle ?? fetched?.title ?? "", docId: fetched?.docId ?? fetched?.id ?? "", note: (!docContent?.length ? "This document is empty, so that's it's full content, you may now edit it knowing that. " : "") + "This is the first time this document has been requested, DO NOT request it again with get_document, instead use it's content if useful to fulfill the request." }),
                        });
                    } else {
                        inputs.push(sanitizeForInput(call));
                        inputs.push({
                            type: "function_call_output",
                            call_id: call.call_id,
                            output: JSON.stringify({ success: false, error: `Unhandled tool: ${call.name}` }),
                        });
                    }
                }

                const cacheMsg = buildDocCacheSystemMessage(docCache, canGetDocuments);
                if (cacheMsg) inputs.push(cacheMsg);
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