import { openaiApi } from "./_ai.js";

export const runtime = 'edge';

export async function POST(req) {
    try {
        const { messages, documents } = await req.json();

        const response = await openaiApi(messages, documents, true);


        const encoder = new TextEncoder();

        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const event of response) {
                        // Main text streaming
                        if (event.type === "response.output_text.delta") {
                            if (event.delta) controller.enqueue(encoder.encode(event.delta));
                            continue;
                        }

                        // If you want, you can also handle finalization events:
                        if (event.type === "response.completed" || event.type === "response.incomplete") {
                            break;
                        }

                        // Errors
                        if (event.type === "response.failed" || event.type === "error") {
                            const msg =
                                event.error?.message ||
                                event.message ||
                                "OpenAI streaming error";
                            throw new Error(msg);
                        }
                    }
                } catch (err) {
                    // Optional: surface something to the client before closing
                    // controller.enqueue(encoder.encode(`\n[error] ${err.message}\n`));
                } finally {
                    controller.close();
                }
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
