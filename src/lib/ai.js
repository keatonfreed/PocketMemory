import OpenAI from 'openai';

// Initialize OpenAI Client
// DANGER: Client-side usage requires dangerouslyAllowBrowser: true
// In a real app, this should go through a backend proxy.
const openai = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true
});

/**
 * Analyzes content using OpenAI GPT-4o-mini (or available).
 */
export async function analyzeContent(text) {
    if (!import.meta.env.VITE_OPENAI_API_KEY) {
        console.warn("No API Key found, falling back to basic");
        return fallbackAnalysis(text);
    }

    try {
        const completion = await openai.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are a "second brain" assistant. Analyze the user's input and return a JSON object with:
            - title: smooth short title
            - summary: concise 1-sentence summary
            - tags: array of 2-4 strings (lowercase, relevant)
            - type: one of "link", "task", "idea", "note", "question"
            - entities: array of 1-3 key people/projects/tech mentioned
            
            Return ONLY valid JSON.`
                },
                { role: "user", content: text }
            ],
            model: "gpt-5-mini",
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(completion.choices[0].message.content);
        return {
            ...result,
            createdAt: new Date().toISOString()
        };

    } catch (error) {
        console.error("AI Error:", error);
        return fallbackAnalysis(text);
    }
}

/**
 * Asks a question using RAG (Retrieval Augmented Generation) on local memories.
 */
/**
 * Asks a question using RAG (Retrieval Augmented Generation) on local memories.
 * Returns an async generator that yields text chunks (Streaming).
 */
export async function* askQuestionStream(question, contextMemories) {
    if (!import.meta.env.VITE_OPENAI_API_KEY) {
        yield "Please set your VITE_OPENAI_API_KEY in .env to use the AI features.";
        return;
    }

    try {
        const contextString = contextMemories.map(m =>
            `- [${m.type}] ${m.title}: ${m.summary} (${m.tags.join(', ')})`
        ).join('\n');

        // New "Response" scaffolding structure requested by user
        // Using standard streaming with updated input format
        const stream = await openai.chat.completions.create({
            model: "gpt-5-mini", // User requested model
            messages: [
                {
                    role: "developer", // "developer" role as requested (replaces system in new models)
                    content: `You are Pocket Memory, a helpful assistant. Use the provided memory context to answer the user's question. 
                    If the answer isn't in the context, say so, but try to be helpful based on general knowledge if implied.
                    Keep answers concise and conversational.`
                },
                {
                    role: "user",
                    content: `Context:\n${contextString}\n\nQuestion: ${question}`
                }
            ],
            stream: true,
        });

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
                yield content;
            }
        }

    } catch (error) {
        console.error("AI Question Error:", error);
        yield "Sorry, I couldn't reach my brain right now.";
    }
}

function fallbackAnalysis(text) {
    // Basic fallback if no key
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
