export async function ensureServiceWorker() {
    if (!("serviceWorker" in navigator)) return null;
    return await navigator.serviceWorker.register("/sw.js");
}

function getUserKey() {
    let key = localStorage.getItem("user_key");
    if (!key) {
        key = "anon:" + crypto.randomUUID();
        localStorage.setItem("user_key", key);
    }
    return key;
}

function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(base64);
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function getVapidPublicKey() {
    const r = await fetch("/api/public-config");
    const j = await r.json();
    if (!j.vapidPublicKey) throw new Error("Missing vapid public key");
    return j.vapidPublicKey;
}

export async function enablePush() {
    const user_key = getUserKey();

    const reg = await ensureServiceWorker();
    if (!reg) throw new Error("Service worker not supported");

    const perm = await Notification.requestPermission();
    if (perm !== "granted") throw new Error("Notifications not granted");

    const vapidPublicKey = await getVapidPublicKey();

    // Reuse existing subscription if already present
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
        sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
    }

    await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_key, subscription: sub }),
    });

    return { user_key, subscribed: true };
}

export async function createSchedule({ title, body, runAtISO, url }) {
    const user_key = getUserKey();

    const r = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            user_key,
            title,
            body,
            run_at: runAtISO,
            url: url || "/",
            icon: "/icon-192.png",
        }),
    });

    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "Failed to create schedule");
    return j.id;
}

export async function listSchedules() {
    const user_key = getUserKey();
    const r = await fetch(`/api/schedules?user_key=${encodeURIComponent(user_key)}`);
    const j = await r.json();
    return j.schedules || [];
}

export async function cancelSchedule(id) {
    const user_key = getUserKey();
    const r = await fetch("/api/schedule-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_key, id }),
    });
    return await r.json();
}
