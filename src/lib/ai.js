/**
 * Analyzes content using the server-side API.
 */
export async function queryMemory(text, context) {
    try {
        console.log("Querying memory for text:", text);
        console.log("Context:", context);

        const response = await fetch('/api/queryMemory', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text,
                documents: context
            }),
        });

        if (!response.ok) {
            throw new Error('Query Memory failed: ' + response.statusText);
        }

        return await response.json();

    } catch (error) {
        console.error("AI Error:", error);
        return fallbackQueryMemory(text);
    }
}

/**
 * Asks a question using RAG (Retrieval Augmented Generation) on local memories.
 * Returns an async generator that yields text chunks (Streaming).
 */
export async function* askMemory(messages, documents) {
    try {
        const response = await fetch('/api/askMemory', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ messages, documents }),
        });

        if (!response.ok) throw new Error("Network response was not ok");
        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            yield decoder.decode(value, { stream: true });
        }

    } catch (error) {
        console.error("AI Ask Memory Error:", error);
        yield fallbackAskMemory();
    }
}

function fallbackQueryMemory(text) {
    return {
        actions: [],
    };
}

function fallbackAskMemory(text) {
    return "Sorry, I couldn't reach my brain right now. Try again later.";
}

