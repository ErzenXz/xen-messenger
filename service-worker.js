// Service Worker for handling background message notifications
const POLL_INTERVAL = 60000; // 1 minute in milliseconds
const API_ENDPOINT = "/newMessages";

// Cache name for offline support
const CACHE_NAME = "message-cache-v1";

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

// Activate event - clean up old caches
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
  // Ensure the service worker takes control immediately
  return self.clients.claim();
});

// Function to check for new messages
async function checkNewMessages() {
  try {
    const response = await fetch(API_ENDPOINT);
    if (!response.ok) throw new Error("Network response was not ok");

    const messages = await response.json();

    if (messages && messages.length > 0) {
      // Group messages by conversation
      const messagesByConversation = messages.reduce((acc, message) => {
        if (!acc[message.conversationId]) {
          acc[message.conversationId] = [];
        }
        acc[message.conversationId].push(message);
        return acc;
      }, {});

      // Create notifications for each conversation
      Object.entries(messagesByConversation).forEach(
        ([conversationId, messages]) => {
          const latestMessage = messages[messages.length - 1];
          const messageCount = messages.length;

          self.registration.showNotification(
            "New Message" + (messageCount > 1 ? "s" : ""),
            {
              body:
                messageCount > 1
                  ? `${messageCount} new messages from ${latestMessage.sender}`
                  : `${latestMessage.sender}: ${latestMessage.content}`,
              icon: "/path/to/notification-icon.png",
              badge: "/path/to/badge-icon.png",
              tag: `conversation-${conversationId}`, // Group notifications by conversation
              renotify: true,
              data: {
                conversationId,
                url: `/conversations/${conversationId}`,
              },
            }
          );
        }
      );
    }
  } catch (error) {
    console.error("Error checking for new messages:", error);
  }
}

// Set up periodic message checking
function startPeriodicMessageCheck() {
  // Initial check
  checkNewMessages();

  // Set up periodic checks
  setInterval(checkNewMessages, POLL_INTERVAL);
}

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const conversationData = event.notification.data;

  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url === conversationData.url) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      return clients.openWindow(conversationData.url);
    })
  );
});

// Handle incoming messages from the web app
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "START_NOTIFICATION_SERVICE") {
    startPeriodicMessageCheck();
  }
});

// Start the periodic check when the service worker starts
startPeriodicMessageCheck();
