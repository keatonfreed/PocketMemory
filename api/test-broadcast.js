import { query } from "./_db.js";
import { sendPush } from "./_webpush.js";

export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

    // Secure this endpoint just like the cron job
    const secret = req.query.secret;
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    let body;
    try {
        body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } catch {
        return res.status(400).json({ error: "Invalid JSON" });
    }

    const { message, title } = body || {};
    const effectiveTitle = title || "Broadcast Test";
    const effectiveMsg = message || "This is a test broadcast.";

    try {
        // Fetch all subscriptions
        const { rows: subs } = await query(`select endpoint, p256dh, auth from push_subscriptions`);

        let sent = 0;
        let failed = 0;
        let errors = [];

        const payload = {
            title: effectiveTitle,
            body: effectiveMsg,
            url: "/",
            icon: "/icon-192.png"
        };

        for (const sub of subs) {
            const subscription = {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth },
            };

            try {
                await sendPush(subscription, payload);
                sent++;
            } catch (err) {
                console.error("Broadcast failed for sub:", err);
                const code = err?.statusCode;
                if (code === 404 || code === 410) {
                    await query(`delete from push_subscriptions where endpoint = $1`, [sub.endpoint]);
                }
                failed++;
                errors.push({ endpoint: sub.endpoint, error: err.message, statusCode: err.statusCode, body: err.body });
            }
        }

        return res.status(200).json({ ok: true, sent, failed, total: subs.length, errors });

    } catch (error) {
        console.error("Broadcast Error:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}
