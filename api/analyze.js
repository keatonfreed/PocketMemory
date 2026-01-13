import OpenAI from 'openai';

export const runtime = 'edge';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY,
});

export async function POST(req) {
    try {
        const { text } = await req.json();

        if (!text) {
            return new Response(JSON.stringify({ error: "Text is required" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

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
            model: "gpt-4o-mini",
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(completion.choices[0].message.content);

        return new Response(JSON.stringify({
            ...result,
            createdAt: new Date().toISOString()
        }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error("AI Analysis Error:", error);
        return new Response(JSON.stringify({ error: "Failed to analyze content" }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
