import OpenAI from 'openai';
import {
    DEFAULT_QUERY_MEMORY_MODEL,
    MAX_DOCUMENT_FETCHES,
    buildQueryMemoryDeveloperPrompt,
    buildQueryMemoryDocumentContext,
    buildQueryMemoryResponseFormat,
    buildQueryMemoryRuntimeStateMessage,
} from './_queryMemoryContract.js';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY,
});

const QUERY_MEMORY_MODEL = process.env.QUERY_MEMORY_MODEL || DEFAULT_QUERY_MEMORY_MODEL;
const ASK_MEMORY_MODEL = process.env.ASK_MEMORY_MODEL || "gpt-4.1-mini";

const DEBUG_AI = true;

function logAI(label, obj = null) {
    if (!DEBUG_AI) return;
    const ts = new Date().toISOString().slice(11, 23);
    if (obj === null) console.log(`[AI ${ts}] ${label}`);
    else console.log(`[AI ${ts}] ${label}`, obj);
}

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

export async function* openaiApi(input, documents = [], stream = false) {
    const messages = Array.isArray(input)
        ? input
        : [{ role: "user", content: input }];

    const contextString = buildQueryMemoryDocumentContext(documents);
    const memoryDeveloperContent = buildQueryMemoryDeveloperPrompt(contextString);

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

        function getDocumentForAI(doc) {
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

        function buildDocContentEnvelope(docsById) {
            const docContentById = {};
            for (const [docId, doc] of docsById.entries()) {
                docContentById[docId] = doc;
            }

            return {
                fetchedDocIds: [...docsById.keys()],
                docContentById,
            };
        }

        function buildStateMessage(docsById, deniedRequest = null) {
            const envelope = buildDocContentEnvelope(docsById);
            return buildQueryMemoryRuntimeStateMessage(envelope, deniedRequest);
        }

        function normalizeNeedDocIds(value) {
            return [...new Set((Array.isArray(value) ? value : [])
                .filter((docId) => typeof docId === "string" && docId.trim())
                .map((docId) => docId.trim()))].slice(0, MAX_DOCUMENT_FETCHES);
        }

        async function* sendOpenAIRequest(initialInputs) {
            const startedAt = Date.now();
            logAI("send.start", {
                last: initialInputs[initialInputs.length - 1],
            });
            const fetchedDocsById = new Map();
            let inputs = [...initialInputs];
            let deniedRequest = null;

            for (let depth = 0; depth < 8; depth++) {
                if (depth > 4) {
                    logAI("WARNING: depth high (possible loop)", { depth });
                }
                logAI("model.SEND_FULL", inputs);

                const requestInput = [
                    { role: "developer", content: memoryDeveloperContent },
                    { role: "developer", content: buildStateMessage(fetchedDocsById, deniedRequest) },
                    ...inputs
                ];

                const modelStartedAt = Date.now();
                const response = await openai.responses.parse({
                    model: QUERY_MEMORY_MODEL,
                    store: false,
                    input: requestInput,
                    max_output_tokens: 1800,
                    text: {
                        format: buildQueryMemoryResponseFormat(),
                    },
                });
                const modelMs = Date.now() - modelStartedAt;

                logAI("model.output.types", { depth, modelMs, types: response.output?.map(o => o.type) });

                const parsed = response.output_parsed || safeJsonParse(response.output_text);
                if (!parsed) throw new Error("No structured JSON output returned.");

                if (parsed.resultType === "final") {
                    const finalOutput = {
                        resultType: "final",
                        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
                    };
                    logAI("final.actions", finalOutput);
                    yield {
                        type: "final",
                        data: finalOutput,
                        meta: {
                            depth,
                            modelMs,
                            totalMs: Date.now() - startedAt,
                            fetchedDocCount: fetchedDocsById.size,
                        },
                    };
                    return;
                }

                if (parsed.resultType !== "needDocs") {
                    throw new Error(`Unknown structured resultType: ${parsed.resultType}`);
                }

                const requestedDocIds = normalizeNeedDocIds(parsed.docIds);
                const invalidDocIds = requestedDocIds.filter((docId) => !documents.some((doc) => doc.docId === docId));
                const freshDocIds = requestedDocIds.filter((docId) => !fetchedDocsById.has(docId) && !invalidDocIds.includes(docId));
                const repeatedDocIds = requestedDocIds.filter((docId) => fetchedDocsById.has(docId));
                const plan = String(parsed.plan || "").slice(0, 200);

                inputs.push({
                    role: "assistant",
                    content: JSON.stringify({ resultType: "needDocs", plan, docIds: requestedDocIds, actions: null }),
                });

                if (freshDocIds.length === 0) {
                    const reason = requestedDocIds.length === 0
                        ? "missing_doc_ids"
                        : repeatedDocIds.length === requestedDocIds.length
                            ? "already_fetched"
                            : "no_valid_fresh_doc_ids";

                    deniedRequest = { reason, docIds: requestedDocIds };
                    yield {
                        type: "debug",
                        step: "need_docs.denied",
                        details: {
                            reason,
                            plan,
                            requestedDocIds,
                            repeatedDocIds,
                            invalidDocIds,
                            fetchedDocIds: [...fetchedDocsById.keys()],
                            modelMs,
                            totalMs: Date.now() - startedAt,
                        },
                    };
                    continue;
                }

                const fetchedThisRound = new Map();
                const missingDocIds = [];

                for (const docId of freshDocIds) {
                    const fetched = documents.find((doc) => doc.docId === docId);
                    const aiDocument = getDocumentForAI(fetched);
                    if (!aiDocument) {
                        missingDocIds.push(docId);
                        continue;
                    }

                    const docContent = aiDocument.docContent ?? "";
                    logAI("need_docs.result", {
                        docId,
                        found: true,
                        docTitle: aiDocument.docTitle,
                        contentType: Array.isArray(docContent) ? "list" : typeof docContent,
                        contentLength: Array.isArray(docContent) ? docContent.length : String(docContent || "").length,
                    });
                    fetchedDocsById.set(docId, aiDocument);
                    fetchedThisRound.set(docId, aiDocument);
                }

                const envelope = buildDocContentEnvelope(fetchedThisRound);
                const docTitles = [...fetchedThisRound.values()].map((doc) => doc.docTitle).filter(Boolean);
                const firstDoc = [...fetchedThisRound.values()][0];
                const firstContent = firstDoc?.docContent ?? "";

                yield {
                    type: "debug",
                    step: "need_docs",
                    details: {
                        plan,
                        requestedDocIds,
                        docIds: freshDocIds,
                        repeatedDocIds,
                        invalidDocIds,
                        missingDocIds,
                        docTitles,
                        foundCount: fetchedThisRound.size,
                        contentType: Array.isArray(firstContent) ? "list" : typeof firstContent,
                        contentLength: Array.isArray(firstContent) ? firstContent.length : String(firstContent || "").length,
                        modelMs,
                        totalMs: Date.now() - startedAt,
                        output: envelope,
                    },
                };

                yield {
                    type: "progress",
                    message: `Reading ${docTitles[0] || "documents"}...`,
                    docId: freshDocIds[0],
                    docTitle: docTitles.length > 1 ? `${docTitles[0]} +${docTitles.length - 1} more` : docTitles[0],
                };

                inputs.push({
                    role: "developer",
                    content: `Fetched document content:\n${JSON.stringify(envelope)}`,
                });
                deniedRequest = null;
            }

            throw new Error("Maximum document planning iterations exceeded.");
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
