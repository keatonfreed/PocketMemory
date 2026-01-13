self.addEventListener("push", (event) => {
    let data = {};
    try {
        data = event.data ? event.data.json() : {};
    } catch { }

    const title = data.title || "Pocket Memory";
    const body = data.body || "";
    const url = data.url || "/";
    const icon = data.icon || "/icon-192.png";

    const options = {
        body,
        icon,
        data: { url },
        requireInteraction: true, // Keep notification until user clicks
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = event.notification?.data?.url || "/";

    event.waitUntil((async () => {
        const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });

        // Focus existing tab if it’s already open
        for (const c of allClients) {
            if ("focus" in c) {
                c.navigate?.(url);
                return c.focus();
            }
        }

        // Otherwise open a new one
        if (clients.openWindow) return clients.openWindow(url);
    })());
});
