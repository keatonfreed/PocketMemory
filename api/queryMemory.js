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

        const result = await openaiApi(text, documents || []);

        if (!result) throw new Error("No AI response returned.");

        return new Response(JSON.stringify({
            ...result,
        }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error("AI Error:", error);
        return new Response(JSON.stringify({ error: "Failed to generate AI response." }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
