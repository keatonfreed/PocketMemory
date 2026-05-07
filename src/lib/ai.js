/**
 * Analyzes content using the server-side API (Streaming).
 * Returns an async generator that yields events (progress or final actions).
 */
export async function* queryMemory(text, context, { requestId } = {}) {
    const shortId = requestId?.slice?.(0, 8) || 'unknown'

    try {
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

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Keep the last incomplete line in buffer

            for (const line of lines) {
                if (line.trim()) {
                    try {
                        const event = JSON.parse(line);
                        yield event;
                    } catch (e) {
                        console.error(`[query-memory:${shortId}] stream.parse_failed`, { line, error: e });
                    }
                }
            }
        }

        // Final buffer check (though Ndjson should end with \n)
        if (buffer.trim()) {
            try {
                const event = JSON.parse(buffer);
                yield event;
            } catch (e) {
                console.error(`[query-memory:${shortId}] stream.final_buffer_parse_failed`, { buffer, error: e });
            }
        }

    } catch (error) {
        console.error(`[query-memory:${shortId}] failed`, error);
        yield {
            type: "error",
            message: error?.message || "AI request failed",
        };
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

function fallbackAskMemory(text) {
    return "Sorry, I couldn't reach my brain right now. Try again later.";
}
