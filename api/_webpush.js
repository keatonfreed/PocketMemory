import webpush from "web-push";

let configured = false;

export function ensureWebPushConfigured() {
    if (configured) return;

    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT;

    if (!pub || !priv || !subject) {
        console.error("VAPID Config Error. Env vars:", {
            pubLen: pub?.length,
            privLen: priv?.length,
            subject,
            hasPub: !!pub,
            hasPriv: !!priv
        });
        throw new Error("Missing VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT");
    }

    webpush.setVapidDetails(subject, pub, priv);
    configured = true;
}

export function sendPush(subscription, payload) {
    ensureWebPushConfigured();
    return webpush.sendNotification(subscription, JSON.stringify(payload), {
        TTL: 60 * 60,
    });
}
