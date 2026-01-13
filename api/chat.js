import OpenAI from 'openai';

export const runtime = 'edge';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY,
});

export async function POST(req) {
    try {
        const { messages, contextMemories } = await req.json();

        const contextString = contextMemories.map(m =>
            `- [${m.type}] ${m.title}: ${m.summary} (${m.tags.join(', ')})`
        ).join('\n');

        const systemMessage = {
            role: "system",
            content: `You are Pocket Memory, a helpful assistant. Use the provided memory context to answer the user's question. 
          If the answer isn't in the context, say so, but try to be helpful based on general knowledge if implied.
          Keep answers concise and conversational.
          
          Context:
          ${contextString}`
        };

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                systemMessage,
                ...messages
            ],
            stream: true,
        });

        const stream = new ReadableStream({
            async start(controller) {
                for await (const chunk of response) {
                    const content = chunk.choices[0]?.delta?.content || "";
                    if (content) {
                        controller.enqueue(new TextEncoder().encode(content));
                    }
                }
                controller.close();
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
            },
        });

    } catch (error) {
        console.error("AI Chat Error:", error);
        return new Response("Sorry, I couldn't reach my brain right now.", { status: 500 });
    }
}
