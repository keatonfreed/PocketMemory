import { query } from "./_db.js";

export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

    let body;
    try {
        body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } catch {
        return res.status(400).json({ error: "Invalid JSON" });
    }

    const { user_key, subscription } = body || {};
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;

    if (!user_key || !endpoint || !p256dh || !auth) {
        return res.status(400).json({ error: "Missing user_key or subscription fields" });
    }

    await query(
        `
    insert into push_subscriptions (user_key, endpoint, p256dh, auth)
    values ($1, $2, $3, $4)
    on conflict (endpoint)
    do update set user_key = excluded.user_key,
                 p256dh = excluded.p256dh,
                 auth = excluded.auth,
                 last_seen_at = now()
    `,
        [user_key, endpoint, p256dh, auth]
    );

    return res.status(200).json({ ok: true });
}
