import { query } from "./_db.js";

function parseISODate(dateStr) {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    return d;
}

export default async function handler(req, res) {
    if (req.method === "GET") {
        const user_key = req.query.user_key;
        if (!user_key) return res.status(400).json({ error: "Missing user_key" });

        const { rows } = await query(
            `
      select id, user_key, title, body, url, icon, run_at, status, created_at, sent_at
      from notification_schedules
      where user_key = $1
      order by run_at desc
      limit 200
      `,
            [user_key]
        );

        return res.status(200).json({ ok: true, schedules: rows });
    }

    if (req.method === "POST") {
        let body;
        try {
            body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
        } catch {
            return res.status(400).json({ error: "Invalid JSON" });
        }

        const { user_key, title, body: msg, url, icon, run_at } = body || {};
        if (!user_key || !title || !msg || !run_at) {
            return res.status(400).json({ error: "Missing user_key/title/body/run_at" });
        }

        const runDate = parseISODate(run_at);
        if (!runDate) return res.status(400).json({ error: "run_at must be a valid date/ISO string" });

        const { rows } = await query(
            `
      insert into notification_schedules (user_key, title, body, url, icon, run_at)
      values ($1, $2, $3, $4, $5, $6)
      returning id
      `,
            [user_key, title, msg, url || null, icon || null, runDate.toISOString()]
        );

        return res.status(200).json({ ok: true, id: rows[0].id });
    }

    return res.status(405).json({ error: "Use GET or POST" });
}
