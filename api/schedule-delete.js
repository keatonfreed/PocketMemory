import { query } from "./_db.js";

export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

    let body;
    try {
        body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } catch {
        return res.status(400).json({ error: "Invalid JSON" });
    }

    const { user_key, id } = body || {};
    if (!user_key || !id) return res.status(400).json({ error: "Missing user_key or id" });

    // soft-cancel pending schedules only
    const result = await query(
        `
    update notification_schedules
    set status = 'cancelled'
    where id = $1 and user_key = $2 and status = 'pending'
    `,
        [id, user_key]
    );

    return res.status(200).json({ ok: true, updated: result.rowCount });
}
