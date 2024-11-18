// Service Worker for handling background message notifications
const POLL_INTERVAL = 60000;
const API_ENDPOINT = "https://apis.erzen.xyz/messaging/unreadMessages";
const TOKEN_REFRESH_INTERVAL = 9 * 60 * 1000;
const MESSAGE_CHECK_INTERVAL = 60 * 1000;
const CACHE_NAME = "message-cache-v1";

// State management
let state = {
  token: null,
  lastTokenRefreshTime: 0,
  alreadyNotified: new Set(),
  isCheckingMessages: false,
};

// Install event - cache essential files
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        "/",
        "./index.html",
        "./src/css/style.css",
        "./src/js/app.js",
      ]);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  return self.clients.claim();
});

async function refreshToken() {
  try {
    const response = await fetch("https://apis.erzen.xyz/v1/auth/refresh", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed with status: ${response.status}`);
    }

    const data = await response.json();
    state.token = data.accessToken;
    state.lastTokenRefreshTime = Date.now();
    return true;
  } catch (error) {
    console.error("Error refreshing token:", error);
    return false;
  }
}

async function fetchUnreadMessages() {
  if (!state.token) {
    console.log("No token available, attempting to refresh...");
    const refreshed = await refreshToken();
    if (!refreshed) {
      throw new Error("Failed to obtain valid token");
    }
  }

  const response = await fetch(API_ENDPOINT, {
    method: "GET",
    credentials: "include",
    headers: {
      Authorization: `Bearer ${state.token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      state.token = null; // Clear invalid token
      throw new Error("Unauthorized - token may be invalid");
    }
    throw new Error(`API request failed with status: ${response.status}`);
  }

  return response.json();
}

function showNotification(message) {
  if (!state.alreadyNotified.has(message.id)) {
    self.registration.showNotification("New Message", {
      body: message.content,
      tag: message.id,
      data: { url: message.url || "/" },
    });
    state.alreadyNotified.add(message.id);
  }
}

async function startPeriodicMessageCheck() {
  // Prevent multiple concurrent checks
  if (state.isCheckingMessages) {
    return;
  }

  try {
    state.isCheckingMessages = true;
    const now = Date.now();

    if (
      !state.token ||
      now - state.lastTokenRefreshTime >= TOKEN_REFRESH_INTERVAL
    ) {
      const refreshed = await refreshToken();
      if (!refreshed) {
        throw new Error("Failed to refresh token");
      }
    }

    const messages = await fetchUnreadMessages();
    messages.forEach(showNotification);
  } catch (error) {
    console.error("Message check failed:", error);
    // If token is invalid, clear it so next attempt will refresh
    if (error.message.includes("Unauthorized")) {
      state.token = null;
    }
  } finally {
    state.isCheckingMessages = false;
    // Schedule next check
    setTimeout(startPeriodicMessageCheck, MESSAGE_CHECK_INTERVAL);
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === event.notification.data.url) {
          return client.focus();
        }
      }
      return clients.openWindow(event.notification.data.url);
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "START_NOTIFICATION_SERVICE") {
    startPeriodicMessageCheck();
  }
});

// Start the periodic check when the service worker starts
startPeriodicMessageCheck();
