import { query } from "./_db.js";
import { sendPush } from "./_webpush.js";

function safeJson(res, code, obj) {
    res.status(code).setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(obj));
}

export default async function handler(req, res) {
    const secret = req.query.secret;
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
        return safeJson(res, 401, { error: "Unauthorized" });
    }

    const batchSize = Math.min(parseInt(req.query.batch || "20", 10) || 20, 100);

    // Lock a batch of due schedules to avoid double-sends
    const { rows: schedules } = await query(
        `
    with picked as (
      select id
      from notification_schedules
      where status = 'pending'
        and run_at <= now()
      order by run_at asc
      limit $1
      for update skip locked
    )
    update notification_schedules ns
    set status = 'processing'
    from picked
    where ns.id = picked.id
    returning ns.*
    `,
        [batchSize]
    );

    let sentCount = 0;
    let failCount = 0;

    for (const s of schedules) {
        try {
            const { rows: subs } = await query(
                `
        select endpoint, p256dh, auth
        from push_subscriptions
        where user_key = $1
        `,
                [s.user_key]
            );

            const payload = {
                title: s.title,
                body: s.body,
                url: s.url,
                icon: s.icon,
                scheduleId: s.id,
            };

            // Send to all devices; remove dead endpoints
            for (const sub of subs) {
                const subscription = {
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.p256dh, auth: sub.auth },
                };

                try {
                    await sendPush(subscription, payload);
                } catch (err) {
                    // web-push uses statusCode for HTTP errors
                    const code = err?.statusCode;
                    if (code === 404 || code === 410) {
                        await query(`delete from push_subscriptions where endpoint = $1`, [sub.endpoint]);
                    }
                    // else keep it (transient errors happen)
                }
            }

            await query(
                `
        update notification_schedules
        set status = 'sent', sent_at = now()
        where id = $1
        `,
                [s.id]
            );
            sentCount++;
        } catch (e) {
            await query(
                `
        update notification_schedules
        set status = 'failed'
        where id = $1
        `,
                [s.id]
            );
            failCount++;
        }
    }

    return safeJson(res, 200, {
        ok: true,
        picked: schedules.length,
        sent: sentCount,
        failed: failCount,
    });
}
