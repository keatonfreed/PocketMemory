import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY,
});

import { performance } from "node:perf_hooks";

function ms(n) { return `${n.toFixed(1)}ms`; }

function now() { return performance.now(); }

function sizeInfo(str) {
    const bytes = Buffer.byteLength(str || "", "utf8");
    return { bytes, kb: (bytes / 1024).toFixed(1) };
}

const PocketMemoryJSONSchema = {
    type: "object",
    additionalProperties: false,
    required: ["actions"],
    properties: {
        actions: {
            type: "array",
            minItems: 1,
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
                                        required: ["docTitle", "docSummary", "docType", "docTags"],
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
                                                enum: ["list", "note"],
                                                description: "Document type."
                                            },
                                            // Optional now, easy to expand later:
                                            docTags: {
                                                type: "array",
                                                description: "Optional tags for organizing documents.",
                                                maxItems: 3,
                                                items: { type: "string" }
                                            },
                                        }
                                    },

                                    // LIST
                                    {
                                        type: "object",
                                        additionalProperties: false,
                                        required: ["docTitle", "docSummary", "docType", "docTags", "listType"],
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
                                                enum: ["list", "note"],
                                                description: "Document type."
                                            },
                                            docTags: {
                                                type: "array",
                                                description: "Optional tags for organizing documents.",
                                                maxItems: 3,
                                                items: { type: "string" }
                                            },
                                            listType: {
                                                type: "string",
                                                enum: ["normal", "grocery"],
                                                description:
                                                    "Type of list, either normal or specific to a grocery or store list."
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
                                                            required: ["content"],
                                                            properties: {
                                                                content: {
                                                                    type: "string",
                                                                    description:
                                                                        "The full text for the new list item. This becomes the item's entire content. Must not be empty."
                                                                }
                                                            }
                                                        }
                                                    }
                                                },

                                                // setListItemCompleted
                                                {
                                                    type: "object",
                                                    additionalProperties: false,
                                                    required: ["modType", "modPayload"],
                                                    properties: {
                                                        modType: {
                                                            type: "string",
                                                            enum: ["setListItemCompleted"],
                                                            description:
                                                                "Set a list item's completed state."
                                                        },
                                                        modPayload: {
                                                            type: "object",
                                                            additionalProperties: false,
                                                            required: ["itemId", "completed"],
                                                            properties: {
                                                                itemId: {
                                                                    type: "string",
                                                                    format: "uuid",
                                                                    description:
                                                                        "UUID of the list item to update."
                                                                },
                                                                completed: {
                                                                    type: "boolean",
                                                                    description:
                                                                        "True to mark completed, false to mark not completed."
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
                                                            required: ["itemId", "docContent"],
                                                            properties: {
                                                                itemId: {
                                                                    type: "string",
                                                                    format: "uuid",
                                                                    description:
                                                                        "UUID of the list item to edit."
                                                                },
                                                                docContent: {
                                                                    type: "string",
                                                                    description:
                                                                        "Replaces the item's entire previous content (not a patch). Keep the meaning, apply the edits, and output the final full text. Must not be empty."
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
                                                                        "Full updated note content (entire doc). Keep existing content and apply the requested edits; output the final full text."
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

export async function openaiApi(input, documents = [], stream = false) {
    const messages = Array.isArray(input)
        ? input
        : [{ role: "user", content: input }];

    const contextString = documents.length > 0
        ? `\n\nExisting Documents:\n${documents.map(d =>
            `- [${d.docId || d.id}] ${d.docTitle || d.title}: ${d.docSummary || d.summary} (${d.docType || d.type}${d.listType ? ` - ${d.listType}` : ""})${d.docTags || d.tags ? ` [${(d.docTags || d.tags).join(", ")}]` : ""}`
        ).join('\n')}`
        : '';

    const memorySystemContent = `You are “Pocket Memory”, a second-brain assistant that converts ONE user message into concrete app actions.

You will be given:
1) The user’s message.
2) A list of the user’s existing documents (each has: docId UUID, docTitle, docSummary, docType, optional docTags, and for lists maybe listType).

Your job:
- Decide the most helpful, confident actions to take RIGHT NOW.
- Prefer acting on existing docs when it clearly matches the user’s intent.
- Avoid duplicates. Create a new doc only when no existing doc is a good fit.
- Output ONLY actions that you are confident are correct. If uncertain between multiple docs, do not guess.

Core meanings:
- createDocument: make a brand-new doc the user will likely want again.
- openDocument: bring an existing doc into view when the user asks to see it, review it, or continue working on it.
- modifyDocument: change an existing doc (lists: add/edit/check items; notes: replace full content).
- deleteDocument: only when the user explicitly asks to delete/remove a doc and it’s unambiguous which one.

How to choose a document:
- Match by exact/similar title first (case-insensitive).
- Then match by summary/topic.
- If multiple candidates match similarly, do not choose; instead choose a safe action (usually createDocument) ONLY if that clearly satisfies the request without harming anything. Otherwise output no actions only if truly unavoidable (but try hard to pick a confident safe action).

High-level decision rules (most important):
1) If the user says “open/show/pull up/view” a doc, use openDocument on the best-matching existing doc.
2) If the user gives edits to an existing doc (“change X”, “add Y”, “mark done”, “remove item”, “rewrite this note”), use modifyDocument on the best-matching existing doc.
3) If the user is capturing NEW information with no clear destination doc, use createDocument.
4) If the user says “delete” and clearly identifies the doc, use deleteDocument.
5) If the user asks for multiple changes, you may return multiple actions in order.

Document type selection:
- docType = "list" when the content is a checklist/todo/groceries/packing list/steps to do.
- docType = "note" when the content is general notes, journal entries, reference info, plans, or anything that isn’t a simple list.

List type selection:
- listType = "grocery" only for food/ingredients/shopping at a store.
- Otherwise listType = "normal".
- Only include listType when docType is "list".

Tags (docTags):
- Use only a few short tags when it improves retrieval (e.g., “school”, “work”, “health”, “shopping”, “travel”, “ideas”).
- Omit if not helpful.

Modifications (modifyDocument.modifications) rules:
- Always include docId and an ordered array of modifications.
- For list docs:
  - addListItem: when user adds a new item. “content” should be the final clean item text.
  - setListItemCompleted: only when user clearly refers to an existing item AND you are provided the itemId (or the app provides it). If you do NOT have itemId, do not fabricate it.
  - editListItem: only when you have the itemId and the user wants to change the item’s text.
- For note docs:
  - editNote replaces the ENTIRE note content. Only use when you are given the current note content (or it’s provided in context) so you can output the full updated content. If you don’t have the existing content, prefer creating a new note or opening the note for the user instead of guessing the full replacement.

Item/content hygiene:
- Never output empty strings.
- Keep list items short and scannable.
- Preserve user wording when it matters (names, numbers, deadlines).
- Normalize tiny stuff like extra spaces, but don’t rewrite aggressively unless asked.

What NOT to do:
- Do not invent docIds or itemIds.
- Do not assume which doc the user meant if multiple match.
- Do not create multiple near-duplicate docs (e.g., “Grocery List” every time) if a clear existing one exists.

When to create vs modify:
- If there is an existing doc that obviously fits (same topic/purpose), modify it.
- If the user’s message is a brand-new topic, or the existing docs are not a fit, create a new doc.
- If the user says “new” or “separate”, createDocument even if a similar doc exists.

Output:
Return a single JSON object that matches the provided schema, with an "actions" array (1+ items).
No extra commentary.

Context:${contextString}`;

    const chatSystemContent = `You are “Pocket Memory”, a second-brain assistant that uses the provided memory and chat history to quickly and accurately respond to the user. Keep answers concise and conversational, and always fully accurate to the context and memory provided, without hallucinating information.

Context:${contextString}`;

    if (stream) {
        return await openai.responses.create({
            model: "gpt-4o-mini",
            input: [
                { role: "system", content: chatSystemContent },
                ...messages
            ],
            stream: true,
        });
    }

    try {
        const response = await openai.responses.parse({
            model: "gpt-4o-mini",
            store: false,
            input: [
                { role: "system", content: memorySystemContent },
                ...messages
            ],
            max_output_tokens: 1000,
            text: {
                format: {
                    type: "json_schema",
                    name: "second_brain",
                    strict: true,
                    schema: PocketMemoryJSONSchema,
                },
            },
        });

        const result = response.output_parsed;
        if (!result) throw new Error("No structured JSON output returned.");
        return result;
    }
    catch (error) {
        console.error("AI network Error:", error);
        throw error;
    }
}