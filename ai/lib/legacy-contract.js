export const DEFAULT_QUERY_MEMORY_MODEL = "gpt-4.1-mini";
export const MAX_DOCUMENT_FETCHES = 5;

export function buildQueryMemoryDocumentContext(documents = []) {
    if (!documents.length) return "";

    return documents.map(d => {
        const listType = d.listType || d.docMetadata?.listType;
        const tags = d.docTags || d.tags;
        return `- \`[${d.docId || d.id}] ${d.docTitle || d.title}: ${d.docSummary || d.summary}\` (${d.docType || d.type}${listType ? ` - ${listType}` : ""})${tags?.length ? ` [${tags.join(", ")}]` : ""}`;
    }).join("\n");
}

export const queryMemoryDeveloperPromptTemplate = `# Role and Objective
You are "Pocket Memory", a second-brain assistant that translates a single user message into specific app actions.

Your responsibility is to interpret the user's latest message and decide what, if anything, the app should do in response.

---

# Instructions
- If the user types complete gibberish, obvious testing, playful typing, or has absolutely no document-related intent, return resultType="final" with actions=[].
- Attempt to understand intent even with spelling mistakes or unclear phrasing.
- Respond with clear, confident app actions.
- Prefer existing documents when at all possible.
- Editing an existing matching document is higher priority than creating a new one.
- Only create a new document if none is clearly suitable, or if the user explicitly asks for a new/separate document.
- Avoid duplicates.
- Do not hallucinate document edits or IDs.
- Use only docIds that appear verbatim in the provided Existing documents list. Never invent, shorten, transform, or guess a docId.
- If the user gives an actionable instruction, make a careful best judgment rather than dropping the request.
- Use actions=[] only for gibberish, obvious testing, playful typing, or truly impossible/harmful ambiguity.

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
- No clear intent and no relation at all to any documents → final with actions=[]

If one user message asks for multiple independent actions, output every requested action in the same final response.

If the user gives a count or range such as "3-5 things", create that many concrete useful items. Do not add a literal item whose text is "3-5 things".

### Step 2: Decide whether hidden document content is required
- If visible document metadata is enough, return resultType="final" with actions.
- If hidden document content is needed to choose or complete the right action, return resultType="needDocs".
- Hidden content is often required for modifyDoc, list item IDs, preserving note text, "find the doc containing...", merging, splitting, summarizing, or comparing existing docs.
- Hidden content is usually NOT required for openDoc / createDoc / deleteDoc when the visible document list is enough.

## Result Types
Return exactly one of these:

- resultType="final": include actions only. Use this when no more hidden content is needed.
- resultType="needDocs": include plan and docIds only. Use this when hidden content is needed before the correct action can be chosen or completed.
Because the strict schema requires all keys, set unused fields to null:
- final uses plan=null and docIds=null.
- needDocs uses actions=null.

When using needDocs:
- plan is one short sentence about what content is needed and what to do after reading it.
- Request all currently relevant docIds needed for the user's request, not just the first one.
- Every docId must be copied exactly from the Existing documents list.
- Never request a docId already listed in fetchedDocIds or docContentById.
- If fetched content reveals another relevant unfetched document is needed, you may return needDocs again for only that additional docId.
- Empty docContent is valid content.

## Provided Document Content
When hidden content has been fetched, it appears in docContentById keyed by docId.
For list documents, docContent items are { itemId, itemContent, itemCompleted }. Always use itemId from that content when editing or deleting existing list items.
The "Existing documents" list is for selection only and does not count as docContent.

---

## Mods
When outputting modifyDoc:
- Always include the docId.
- Always include an ordered array of mods.
- All edits must be based strictly on the provided docContent.

### For list documents:
- **addListItem**: add a new item (usually itemCompleted = false).
- **editListItem**: replace the entire content/completed state of an existing item using itemId from docContentById.
- **deleteListItem**: permanently remove an item using itemId from docContentById (use sparingly).

### For note documents:
- **editNote** replaces the ENTIRE document content.
- Only use editNote when the full existing content is known from docContentById.
- Do not guess or partially rewrite notes.
- If a note contains hashtags, bullets, lines, or paragraphs, still use editNote. Never use addListItem/editListItem/deleteListItem on a note.

---

## Output Hygiene
- Return a single JSON object matching the resultType schema.
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
{{DOCUMENT_CONTEXT}}`;

export function buildQueryMemoryDeveloperPrompt(documentsOrContext = []) {
    const documentContext = Array.isArray(documentsOrContext)
        ? buildQueryMemoryDocumentContext(documentsOrContext)
        : String(documentsOrContext || "");

    return queryMemoryDeveloperPromptTemplate.replace("{{DOCUMENT_CONTEXT}}", documentContext);
}

export const queryMemoryIntentStateInstruction = "Return final actions if visible document metadata is enough; return needDocs only when hidden document content is needed.";
export const queryMemoryHasDocumentsStateInstruction = "Use docContentById for fetched documents. Return final actions if enough content is available; return needDocs only for additional relevant docIds not already fetched.";

export function buildQueryMemoryIntentStateMessage() {
    return [
        "STATE: INTENT",
        queryMemoryIntentStateInstruction,
    ].join("\n");
}

export function buildQueryMemoryContentStateMessage(envelope) {
    return [
        "STATE: HAS_DOCUMENTS",
        queryMemoryHasDocumentsStateInstruction,
        "",
        "Fetched document content:",
        JSON.stringify(envelope),
    ].join("\n");
}

export function buildQueryMemoryRuntimeStateMessage(envelope = null, deniedRequest = null) {
    const hasDocuments = Boolean(envelope?.fetchedDocIds?.length);
    const lines = [
        `STATE: ${hasDocuments ? "HAS_DOCUMENTS" : "INTENT"}`,
        hasDocuments ? queryMemoryHasDocumentsStateInstruction : queryMemoryIntentStateInstruction,
    ];

    if (deniedRequest) {
        lines.push(`Last needDocs request was denied: ${deniedRequest.reason}. Do not request those docIds again; use available content or return final actions.`);
    }

    if (hasDocuments) {
        lines.push("");
        lines.push("Fetched document content:");
        lines.push(JSON.stringify(envelope));
    }

    return lines.join("\n");
}

export const queryMemoryGetDocsParameters = {
    type: "object",
    properties: {
        docIds: {
            type: "array",
            minItems: 1,
            maxItems: MAX_DOCUMENT_FETCHES,
            description: "Unique short document ids to retrieve, including full content and metadata.",
            items: { type: "string" },
        },
    },
    required: ["docIds"],
    additionalProperties: false,
};

export const queryMemoryGetDocsTool = {
    type: "function",
    name: "get_docs",
    description: "Retrieve one or more full documents by id, including all content, tags, and metadata.",
    strict: true,
    parameters: queryMemoryGetDocsParameters,
};

export const queryMemoryChatGetDocsTool = {
    type: "function",
    function: {
        name: queryMemoryGetDocsTool.name,
        description: queryMemoryGetDocsTool.description,
        parameters: queryMemoryGetDocsTool.parameters,
        strict: queryMemoryGetDocsTool.strict,
    },
};

export const queryMemoryActionsArraySchema = {
    type: "array",
    items: {
        anyOf: [
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
                            {
                                type: "object",
                                additionalProperties: false,
                                required: ["docTitle", "docSummary", "docType", "docContent", "docTags"],
                                properties: {
                                    docTitle: {
                                        type: "string",
                                        description: "Short human-friendly title for the new document. Must be unique (app will enforce)."
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
                                    docTags: {
                                        type: "array",
                                        description: "Optional tags for organizing documents.",
                                        items: { type: "string" }
                                    }
                                }
                            },
                            {
                                type: "object",
                                additionalProperties: false,
                                required: ["docTitle", "docSummary", "docType", "docTags", "docContent", "docMetadata"],
                                properties: {
                                    docTitle: {
                                        type: "string",
                                        description: "Short human-friendly title for the new document. Must be unique (app will enforce)."
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
                                                description: "Type of list, either normal or specific to a grocery or store list."
                                            }
                                        }
                                    }
                                }
                            }
                        ]
                    }
                }
            },
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
            {
                type: "object",
                additionalProperties: false,
                required: ["actionType", "actionPayload"],
                properties: {
                    actionType: {
                        type: "string",
                        enum: ["openDoc"],
                        description: "Open an existing document for the user to view and/or edit."
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
            {
                type: "object",
                additionalProperties: false,
                required: ["actionType", "actionPayload"],
                properties: {
                    actionType: {
                        type: "string",
                        enum: ["modifyDoc"],
                        description: "Apply one or more mods to an existing document."
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
                                description: "One or more document mods to apply in order.",
                                items: {
                                    anyOf: [
                                        {
                                            type: "object",
                                            additionalProperties: false,
                                            required: ["modType", "modPayload"],
                                            properties: {
                                                modType: {
                                                    type: "string",
                                                    enum: ["addListItem"],
                                                    description: "Add a new item to a list document."
                                                },
                                                modPayload: {
                                                    type: "object",
                                                    additionalProperties: false,
                                                    required: ["itemContent", "itemCompleted"],
                                                    properties: {
                                                        itemCompleted: {
                                                            type: "boolean",
                                                            description: "Whether the new list item is completed."
                                                        },
                                                        itemContent: {
                                                            type: "string",
                                                            description: "The full text for the new list item. This becomes the item's entire content. Must not be empty."
                                                        }
                                                    }
                                                }
                                            }
                                        },
                                        {
                                            type: "object",
                                            additionalProperties: false,
                                            required: ["modType", "modPayload"],
                                            properties: {
                                                modType: {
                                                    type: "string",
                                                    enum: ["editListItem"],
                                                    description: "Replace the content of an existing list item."
                                                },
                                                modPayload: {
                                                    type: "object",
                                                    additionalProperties: false,
                                                    required: ["itemId", "itemContent", "itemCompleted"],
                                                    properties: {
                                                        itemId: {
                                                            type: "string",
                                                            description: "The itemId from the docContentById item to edit."
                                                        },
                                                        itemCompleted: {
                                                            type: "boolean",
                                                            description: "Whether the list item is completed."
                                                        },
                                                        itemContent: {
                                                            type: "string",
                                                            description: "Replaces the item's entire previous content (not a patch). Keep the meaning, apply the edits, and output the final full text. Must not be empty."
                                                        }
                                                    }
                                                }
                                            }
                                        },
                                        {
                                            type: "object",
                                            additionalProperties: false,
                                            required: ["modType", "modPayload"],
                                            properties: {
                                                modType: {
                                                    type: "string",
                                                    enum: ["deleteListItem"],
                                                    description: "Delete a list item completely (not just mark it as completed, only use this if the item should be truly deleted forever ie. from an error)."
                                                },
                                                modPayload: {
                                                    type: "object",
                                                    additionalProperties: false,
                                                    required: ["itemId"],
                                                    properties: {
                                                        itemId: {
                                                            type: "string",
                                                            description: "The itemId from the docContentById item to delete."
                                                        }
                                                    }
                                                }
                                            }
                                        },
                                        {
                                            type: "object",
                                            additionalProperties: false,
                                            required: ["modType", "modPayload"],
                                            properties: {
                                                modType: {
                                                    type: "string",
                                                    enum: ["editNote"],
                                                    description: "Replace the full content of a note document."
                                                },
                                                modPayload: {
                                                    type: "object",
                                                    additionalProperties: false,
                                                    required: ["docContent"],
                                                    properties: {
                                                        docContent: {
                                                            type: "string",
                                                            description: "Full updated note content (entire doc). Keep/repeat all existing content and simply apply the requested edits; output the final full text to replace old content."
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
};

export const queryMemoryOutputSchema = {
    type: "object",
    additionalProperties: false,
    required: ["resultType", "plan", "docIds", "actions"],
    properties: {
        resultType: {
            type: "string",
            enum: ["final", "needDocs"],
            description: "Use final when actions can be returned now; use needDocs when hidden content is needed first."
        },
        plan: {
            anyOf: [
                {
                    type: "string",
                    description: "For needDocs, a short plan for why these documents are needed and what to do after reading them. Use null for final."
                },
                { type: "null" }
            ]
        },
        docIds: {
            anyOf: [
                {
                    type: "array",
                    description: "For needDocs, unique docIds from the Existing documents list whose hidden content is needed. Use null for final.",
                    items: { type: "string" }
                },
                { type: "null" }
            ]
        },
        actions: {
            anyOf: [
                queryMemoryActionsArraySchema,
                { type: "null" }
            ]
        }
    }
};

export function buildQueryMemoryResponseFormat() {
    return {
        type: "json_schema",
        name: "second_brain",
        strict: true,
        schema: queryMemoryOutputSchema,
    };
}
