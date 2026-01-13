import { query } from "./_db.js";

export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

    let body;
    try {
        body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } catch {
        return res.status(400).json({ error: "Invalid JSON" });
    }

    const { endpoint } = body || {};
    if (!endpoint) return res.status(400).json({ error: "Missing endpoint" });

    await query(`delete from push_subscriptions where endpoint = $1`, [endpoint]);
    return res.status(200).json({ ok: true });
}
