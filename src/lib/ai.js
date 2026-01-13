/**
 * Analyzes content using the server-side API.
 */
export async function analyzeContent(text) {
    try {
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text }),
        });

        if (!response.ok) {
            throw new Error('Analysis failed');
        }

        return await response.json();

    } catch (error) {
        console.error("AI Error:", error);
        return fallbackAnalysis(text);
    }
}

/**
 * Asks a question using RAG (Retrieval Augmented Generation) on local memories.
 * Returns an async generator that yields text chunks (Streaming).
 */
export async function* askQuestionStream(messages, contextMemories) {
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ messages, contextMemories }),
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
        console.error("AI Question Error:", error);
        yield "Sorry, I couldn't reach my brain right now.";
    }
}

function fallbackAnalysis(text) {
    // Basic fallback if API fails
    const type = text.includes("http") ? "link" : "note";
    return {
        title: text.slice(0, 20) + "...",
        summary: text.slice(0, 50),
        tags: ["saved"],
        type,
        entities: [],
        createdAt: new Date().toISOString()
    };
}
