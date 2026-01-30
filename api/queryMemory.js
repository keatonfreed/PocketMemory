import { openaiApi } from "./_ai.js";

export const runtime = 'edge';

export async function POST(req) {
    try {
        const { text, documents } = await req.json();

        if (!text) {
            return new Response(JSON.stringify({ error: "Text is required" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    const generator = openaiApi(text, documents || []);
                    for await (const event of generator) {
                        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
                    }
                    controller.close();
                } catch (error) {
                    console.error("Streaming Error:", error);
                    controller.error(error);
                }
            }
        });

        return new Response(stream, {
            headers: { "Content-Type": "application/x-ndjson" }
        });

    } catch (error) {
        console.error("AI Error:", error);
        return new Response(JSON.stringify({ error: "Failed to generate AI response." }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}

