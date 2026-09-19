const DEFAULT_URL = "/";
const DEFAULT_ICON = "/icon-192.png";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

async function applyBadge(count) {
  const value = Number.isFinite(count) ? Math.max(0, count) : 0;
  if (!("setAppBadge" in self.navigator) || !("clearAppBadge" in self.navigator)) {
    return;
  }

  if (value > 0) {
    await self.navigator.setAppBadge(value);
  } else {
    await self.navigator.clearAppBadge();
  }
}

function parsePushPayload(event) {
  if (!event.data) return {};
  try {
    return event.data.json();
  } catch {
    return {
      title: "Samuelsson Cuts",
      body: event.data.text(),
      url: DEFAULT_URL,
    };
  }
}

self.addEventListener("push", (event) => {
  const payload = parsePushPayload(event);
  const title = payload.title || "Samuelsson Cuts";
  const url = payload.url || DEFAULT_URL;
  const badgeCount = typeof payload.badgeCount === "number" ? payload.badgeCount : 0;

  event.waitUntil(
    Promise.all([
      applyBadge(badgeCount),
      self.registration.showNotification(title, {
        body: payload.body,
        icon: DEFAULT_ICON,
        badge: DEFAULT_ICON,
        tag: payload.tag || "samuelsson-cuts",
        data: { url, badgeCount },
      }),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || DEFAULT_URL;
  // Only ever open same-origin targets; anything else falls back to the app root.
  let targetUrl = new URL(url, self.location.origin);
  if (targetUrl.origin !== self.location.origin) {
    targetUrl = new URL(DEFAULT_URL, self.location.origin);
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === targetUrl.origin && "focus" in client) {
          client.navigate(targetUrl.href);
          return client.focus();
        }
      }

      return self.clients.openWindow(targetUrl.href);
    }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "SET_BADGE") return;
  event.waitUntil(applyBadge(event.data.count));
});
