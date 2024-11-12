let userInfo = null;
let selectedUser = null;
let conversationInfo = null;
let userMessages = null;
let newMessagesIdsToFix = 0;

let toastContainer = document.querySelector(".toast-container");
if (!toastContainer) {
  toastContainer = document.createElement("div");
  toastContainer.className = "toast-container";
  document.body.appendChild(toastContainer);
}

// Function to show toast
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  const msg = document.createElement("div");
  msg.className = "message";
  msg.textContent = message;

  const progressBarContainer = document.createElement("div");
  progressBarContainer.className = "progress-bar-container";

  const progressBar = document.createElement("div");
  progressBar.className = "progress-bar";

  progressBarContainer.appendChild(progressBar);
  toast.appendChild(msg);
  toast.appendChild(progressBarContainer);
  toastContainer.appendChild(toast);

  // Remove toast after 5 seconds
  setTimeout(() => {
    toast.remove();
  }, 5000);

  return progressBar;
}

function updateProgress(progressBar, progress) {
  progressBar.style.width = `${progress}%`;
}
class MessagingWidget {
  user;
  constructor() {
    this.init();
  }

  async init() {
    this.widget = document.querySelector(".msg-widget");
    this.trigger = document.querySelector(".widget-trigger");
    this.closeBtn = document.querySelector(".widget-close");
    this.searchInput = document.querySelector(".search-input");
    this.conversationsContainer = document.querySelector(".conversations");
    this.userListContainer = document.querySelector(".user-list");
    this.messagesContainer = document.querySelector(".messages");
    this.messageInput = document.querySelector(".message-input");
    this.messageForm = document.querySelector(".message-form");
    this.attachmentBtn = document.querySelector(".attachment-btn");
    this.videoCallBtn = document.querySelector(".action-btn");

    this.headerTitle = document.querySelector(".widget-title");
    this.searchBox = document.querySelector(".search-box");

    // Create and add back button
    this.backButton = document.createElement("button");
    this.backButton.className = "back-button";
    this.backButton.innerHTML = '<i class="fas fa-arrow-left"></i>';
    document.querySelector(".header-left").prepend(this.backButton);

    // Create user info element
    this.userInfo = document.createElement("div");
    this.userInfo.className = "user-info";
    this.userInfo.innerHTML = `
      <img src="" alt="Profile" />
      <h3 class="user-name"></h3>
    `;

    this.currentConversation = null;
    this.searchTimeout = null;
    this.currentPage = 1;
    this.perPage = 15;

    this.refreshTokenInterval = setInterval(
      () => this.refreshToken(),
      9 * 60 * 1000
    );
    this.refreshToken();
    userInfo = await this.getUserInfo();
    this.initializeEventListeners();
    this.loadConversations();
    this.registerServiceWorker();
  }

  initializeEventListeners() {
    // Toggle widget
    this.trigger.addEventListener("click", () => {
      this.widget.classList.add("active");
      this.trigger.style.display = "none";
    });

    this.closeBtn.addEventListener("click", () => {
      this.widget.classList.remove("active");
      this.trigger.style.display = "block";
      this.showConversations();
      this.resetHeader();
    });

    this.backButton.addEventListener("click", () => {
      this.showConversations();
      this.resetHeader();
    });

    // Attachment button
    this.attachmentBtn.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.accept = "image/*,.pdf,.doc,.docx";
      input.onchange = (e) => this.handleFileAttachment(e.target.files);
      input.click();
    });

    // Video call button
    this.videoCallBtn.addEventListener("click", () => {
      if (this.currentConversation) {
        this.startVideoCall();
      } else {
        alert("Please select a conversation first");
      }
    });

    // Search users
    this.searchInput.addEventListener("input", (e) => {
      clearTimeout(this.searchTimeout);
      const query = e.target.value.trim();

      if (query) {
        this.searchTimeout = setTimeout(() => this.searchUsers(query), 300);
        this.showUserList();
      } else {
        this.showConversations();
      }
    });

    this.socket = io("wss://localhost:3000", {
      transports: ["websocket"],
      query: {
        token: localStorage.getItem("token"),
      },
    });

    this.socket.on("refreshMessages", async () => {
      this.fastLoadMessages();
      this.loadConversations();
    });

    // Auto-resize textarea
    const textarea = this.messageForm.querySelector(".message-textbox");
    textarea.addEventListener("input", () => {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
    });

    // Send message
    this.messageForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const content = this.messageForm
        .querySelector(".message-textbox")
        .value.trim();
      if (content && this.currentConversation) {
        this.sendMessage(content);
        // Reset textarea height
        this.messageForm.querySelector(".message-textbox").style.height =
          "auto";
      }
    });

    // Infinite scroll for messages
    this.messagesContainer.addEventListener("scroll", () => {
      if (this.messagesContainer.scrollTop === 0) {
        this.loadMoreMessages();
      }
    });
  }

  handleFileAttachment(files) {
    if (!files || files.length === 0) return;

    const formData = new FormData();
    const file = files[0];
    formData.append("file", file);
    let uploadedImageUrl = null;

    const progressToast = showToast("Uploading...", "info");

    fetch("https://api.erzen.xyz/storage/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: formData,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let done = false;

        while (!done) {
          const { value, done: streamDone } = await reader.read();
          done = streamDone;

          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            const messages = chunk
              .split("\n\n")
              .filter((msg) => msg.trim() !== "")
              .map((msg) => msg.replace("data: ", ""));

            messages.forEach((msg) => {
              try {
                const data = JSON.parse(msg);

                if (data.error) {
                  console.log(data.error);
                  return;
                }

                if (data.progress) {
                  updateProgress(progressToast, data.progress);
                }

                if (data.url) {
                  uploadedImageUrl = data.url;
                }
              } catch (e) {
                console.log("Progress update:", msg);
              }
            });
          }
        }

        showToast("Upload completed successfully", "success");
        this.sendMessage(uploadedImageUrl);
        await uploadImage(uploadedImageUrl);
      })
      .catch((error) => {
        showToast(`Upload failed: ${error.message}`, "error");
      });
  }

  startVideoCall() {
    // Implement video call logic here
    console.log(
      "Starting video call for conversation:",
      this.currentConversation
    );
  }

  async searchUsers(query) {
    try {
      this.userListContainer.innerHTML =
        '<div class="loading">Searching...</div>';
      const response = await fetch(
        `https://localhost:3000/messaging/searchUsers?query=${encodeURIComponent(
          query
        )}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      const users = await response.json();

      this.userListContainer.innerHTML = users
        .filter((user) => user.id !== userInfo.id)
        .map(
          (user) => `
          <div class="user-item" data-username="${user.username}" data-id="${user.id}">
          <div>@${user.username}</div>
          </div>
          `
        )
        .join("");

      this.userListContainer.querySelectorAll(".user-item").forEach((item) => {
        item.addEventListener("click", () => {
          selectedUser = item.dataset.username;
          this.currentConversation = item.dataset.id;
          this.startConversation(item.dataset.username, item.dataset.id);
        });
      });
    } catch (error) {
      this.userListContainer.innerHTML =
        '<div class="loading">Error searching users</div>';
    }
  }

  async getUserInfo() {
    try {
      const response = await fetch("https://localhost:3000/v1/auth/info", {
        credentials: "include",
      });
      const user = await response.json();

      return user;
    } catch (error) {
      console.error("Error getting user info:", error);
    }
  }

  async loadConversations() {
    try {
      this.conversationsContainer.innerHTML =
        '<div class="loading">Loading conversations...</div>';
      const response = await fetch(
        "https://localhost:3000/messaging/conversations",
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      const conversations = await response.json();

      this.conversationsContainer.innerHTML = conversations
        .map(
          (conv) => `
          <div class="conversation" data-id="${conv.id}" data-username="${
            conv.username
          }">
          <img src="${
            conv.profilePicture ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(
              conv.fullName
            )}&background=random&length=2&format=svg`
          }" alt="${conv.username}" class="profile-image">
          <div class="conversation-items">
          <p class="conversation-fullName" title="${conv.fullName}">${
            conv.fullName
          }</p>
          <p class="conversation-username" title="${
            conv.lastMessage || "No messages yet"
          }">
          ${!conv.hasSeen ? '<span class="unseen-indicator"></span>' : ""}
          ${conv.lastMessage || "No messages yet"}</p>
          </div>
          <small title="@${conv.username}">@${conv.username}</small>
          </div>
          `
        )
        .join("");

      this.conversationsContainer
        .querySelectorAll(".conversation")
        .forEach((item) => {
          item.addEventListener("click", () =>
            this.openConversation(item.dataset.id, item.dataset.username)
          );
        });
    } catch (error) {
      this.conversationsContainer.innerHTML =
        '<div class="loading">Error loading conversations</div>';
    }
  }

  async registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.register(
          "../service-worker.js"
        );

        // Request notification permission
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          // Start the notification service
          registration.active.postMessage({
            type: "START_NOTIFICATION_SERVICE",
          });
        }

        console.log(
          "Service Worker registered successfully:",
          registration.scope
        );
      } catch (error) {
        console.error("Service Worker registration failed:", error);
      }
    }
  }

  async openConversation(id, username) {
    this.currentConversation = id;
    this.currentPage = 1;
    selectedUser = username;

    this.showConversationHeader(username);

    this.showMessages();
    await this.loadMessages();
  }

  async loadMessages() {
    try {
      this.messagesContainer.innerHTML =
        '<div class="loading">Loading messages...</div>';
      const response = await fetch(
        `https://localhost:3000/messaging/messages/${this.currentConversation}?page=${this.currentPage}&pageSize=${this.perPage}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      const messages = await response.json();
      userMessages = messages;
      const user = userInfo;
      this.messagesContainer.innerHTML = messages
        .map(
          (msg) => `
          <div data-message-id="${msg.id}" class="message ${
            msg.senderId === user.id ? "sent" : "received"
          }">
          <div class="message-content">${this.processMessage(msg.content)}</div>
          <div class="message-time">${this.relativeTime(msg.timestamp)}</div>
          </div>
          `
        )
        .join("");

      // Add event listeners to each message element for the context menu
      const messageElements =
        this.messagesContainer.querySelectorAll(".message");
      messageElements.forEach((messageElement) => {
        messageElement.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          const messageId = messageElement.getAttribute("data-message-id");
          this.showContextMenu(e.pageX, e.pageY, messageId);
        });
      });

      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    } catch (error) {
      this.messagesContainer.innerHTML =
        '<div class="loading">Error loading messages</div>';
    }
  }

  async fastLoadMessages() {
    try {
      const response = await fetch(
        `https://localhost:3000/messaging/messages/${this.currentConversation}?page=${this.currentPage}&pageSize=${this.perPage}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      const messages = await response.json();
      const user = userInfo;

      const newMessages = Array.isArray(messages)
        ? messages.filter(
            (msg) => !userMessages.some((umsg) => umsg.id === msg.id)
          )
        : [];

      console.log(newMessages);

      this.messagesContainer.innerHTML += newMessages
        .map(
          (msg) => `
          <div data-message-id="${msg.id}" class="message ${
            msg.senderId === user.id ? "sent" : "received"
          }">
          <div class="message-content">${this.processMessage(msg.content)}</div>
          <div class="message-time">${this.relativeTime(msg.timestamp)}</div>
          </div>
          `
        )
        .join("");

      // Add event listeners to each message element for the context menu
      const messageElements =
        this.messagesContainer.querySelectorAll(".message");
      messageElements.forEach((messageElement) => {
        messageElement.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          const messageId = messageElement.getAttribute("data-message-id");
          this.showContextMenu(e.pageX, e.pageY, messageId);
        });
      });

      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    } catch (error) {
      console.error("Error fast loading messages:", error);
    }
  }

  async loadMoreMessages() {
    if (!this.currentConversation) return;

    try {
      const response = await fetch(
        `https://localhost:3000/messaging/messages/${
          this.currentConversation
        }?page=${this.currentPage + 1}&pageSize=${this.perPage}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      const messages = await response.json();

      if (messages.length > 0) {
        this.currentPage++;
        const oldHeight = this.messagesContainer.scrollHeight;

        const user = userInfo;
        this.messagesContainer.insertAdjacentHTML(
          "afterbegin",
          messages
            .map(
              (msg) => `
          <div class="message ${
            msg.senderId === user.id || msg.receiverId === user.id
              ? "sent"
              : "received"
          }">
            <div class="message-content">${this.processMessage(
              msg.content
            )}</div>
                    <div class="message-time">${this.relativeTime(
                      msg.timestamp
                    )}</div>

          </div>
              `
            )
            .join("")
        );
        this.messagesContainer.scrollTop =
          this.messagesContainer.scrollHeight - oldHeight;
      }
    } catch (error) {
      console.error("Error loading more messages:", error);
    }
  }

  async sendMessage(content) {
    try {
      const response = await fetch(
        "https://localhost:3000/messaging/send/" + selectedUser,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({
            content,
          }),
        }
      );

      this.messagesContainer.innerHTML += `
      <div id="fix-${(newMessagesIdsToFix =
        newMessagesIdsToFix + 1)}" class="sent message">
        <div class="message-content">${this.processMessage(content)}</div>
        <div class="message-time">just now</div>
      </div>
      `;
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
      if (response.ok) {
        this.messageForm.querySelector(".message-textbox").value = "";
      }

      let data = await response.json();
      if (data) {
        const messageElement = document.getElementById(
          "fix-" + newMessagesIdsToFix
        );
        if (messageElement) {
          let att1 = document.createAttribute("data-message-id");
          att1.value = data.id;
          messageElement.setAttributeNode(att1);
        }

        // Add event listeners to each message element for the context menu
        const messageElements =
          this.messagesContainer.querySelectorAll(".message");
        messageElements.forEach((messageElement) => {
          messageElement.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            const messageId = messageElement.getAttribute("data-message-id");
            this.showContextMenu(e.pageX, e.pageY, messageId);
          });
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }

  processMessage(message) {
    function escapeHtml(str) {
      return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    const escapedMessage = escapeHtml(message);

    const urlPattern = /(https?:\/\/[^\s]+)/g;

    const processedMessage = escapedMessage.replace(urlPattern, function (url) {
      const isImageExtension = url.match(/\.(jpeg|jpg|gif|png|bmp|svg|webp)$/i);
      const isS3Image = url.startsWith(
        "https://xen-auth.s3.eu-west-3.amazonaws.com/"
      );

      if (isImageExtension || isS3Image) {
        return `<img loading="lazy" onclick="openImage('${url}')" src="${url}" alt="Image">`;
      } else {
        return `<a target="_blank" href="${url}?rel=https://messenger.erzen.xyz">${url}</a>`;
      }
    });

    return processedMessage;
  }

  async startConversation(username, id) {
    try {
      selectedUser = username;
      this.currentConversation = id;
      this.showMessages();
      await this.loadMessages();
      await this.loadConversations();
    } catch (error) {
      console.error("Error starting conversation:", error);
    }
  }
  async refreshToken() {
    const token = localStorage.getItem("token");
    const expiresAt = localStorage.getItem("expiresAt");
    const now = new Date().getTime();

    if (!token || !expiresAt || now >= expiresAt - 60 * 1000) {
      try {
        const response = await fetch("https://localhost:3000/v1/auth/refresh", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          localStorage.setItem("token", data.accessToken);
          const newExpiresAt = now + 9.5 * 60 * 1000;
          localStorage.setItem("expiresAt", newExpiresAt);
        }
      } catch (error) {
        console.error("Error refreshing token:", error);
      }
    }
  }

  showContextMenu(x, y, messageId) {
    // Create the context menu element
    let contextMenu = document.getElementById("context-menu");
    if (!contextMenu) {
      contextMenu = document.createElement("div");
      contextMenu.id = "context-menu";
      contextMenu.innerHTML = `
        <ul>
          <li id="copy-message">Copy</li>
          <li id="delete-message">Delete</li>
        </ul>
      `;
      document.body.appendChild(contextMenu);
    }

    // Position and display the context menu
    contextMenu.style.top = `${y}px`;
    contextMenu.style.left = `${x}px`;
    contextMenu.style.display = "block";

    // Add event listeners for the menu options
    document.getElementById("copy-message").onclick = () => {
      this.copyMessage(messageId);
      this.hideContextMenu();
    };
    document.getElementById("delete-message").onclick = () => {
      this.deleteMessage(messageId);
      this.hideContextMenu();
    };

    // Hide the context menu when clicking elsewhere
    document.addEventListener("click", this.hideContextMenu);
  }

  hideContextMenu() {
    const contextMenu = document.getElementById("context-menu");
    if (contextMenu) {
      contextMenu.style.display = "none";
    }
    document.removeEventListener("click", this.hideContextMenu);
  }

  copyMessage(messageId) {
    const messageContent = document.querySelector(
      `.message[data-message-id="${messageId}"] .message-content`
    ).innerText;
    navigator.clipboard.writeText(messageContent);
  }

  async deleteMessage(messageId) {
    try {
      const response = await fetch(
        `https://localhost:3000/messaging/delete/${messageId}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      if (response.ok) {
        const messageElement = document.querySelector(
          `.message[data-message-id="${messageId}"]`
        );
        messageElement.remove();
      }
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  }

  relativeTime(time) {
    const date = new Date(time);
    const now = new Date();
    const diff = now - date;

    if (diff < 1000) {
      return "just now";
    } else if (diff < 60 * 1000) {
      return Math.floor(diff / 1000) + "s ago";
    } else if (diff < 60 * 60 * 1000) {
      return Math.floor(diff / (60 * 1000)) + "m ago";
    } else if (diff < 24 * 60 * 60 * 1000) {
      return Math.floor(diff / (60 * 60 * 1000)) + "h ago";
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  }

  showConversations() {
    this.conversationsContainer.style.display = "block";
    this.userListContainer.style.display = "none";
    this.messagesContainer.style.display = "none";
    this.messageInput.style.display = "none";
    this.currentConversation = null;
    selectedUser = null;
    this.resetHeader();
  }

  showMessages() {
    this.conversationsContainer.style.display = "none";
    this.userListContainer.style.display = "none";
    this.messagesContainer.style.display = "block";
    this.messageInput.style.display = "block";
  }

  showConversationHeader(username) {
    this.headerTitle.style.display = "none";
    this.backButton.style.display = "block";
    this.userInfo.style.display = "flex";
    this.searchBox.style.display = "none";

    // Update user info
    const userImg = this.userInfo.querySelector("img");
    const userName = this.userInfo.querySelector(".user-name");
    userImg.src =
      "https://icons-for-free.com/iff/png/512/facebook+profile+user+profile+icon-1320184041317225686.png"; // Default or fetch actual user image
    userName.textContent = username;
  }

  showUserList() {
    this.conversationsContainer.style.display = "none";
    this.userListContainer.style.display = "block";
    this.messagesContainer.style.display = "none";
    this.messageInput.style.display = "none";
  }

  resetHeader() {
    this.headerTitle.style.display = "block";
    this.backButton.style.display = "none";
    this.userInfo.style.display = "none";
    this.searchBox.style.display = "block";
  }
}

function openImage(url) {
  // Create modal elements
  const modal = document.createElement("div");
  modal.id = "imageModal";
  modal.style.position = "fixed";
  modal.style.top = "0";
  modal.style.left = "0";
  modal.style.width = "100%";
  modal.style.height = "100%";
  modal.style.backgroundColor = "rgba(0,0,0,0.8)";
  modal.style.display = "flex";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
  modal.style.zIndex = "1000";

  const img = document.createElement("img");
  img.src = url;
  img.style.maxWidth = "90%";
  img.style.maxHeight = "90%";
  img.style.borderRadius = "8px";
  img.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.2)";

  const closeButton = document.createElement("span");
  closeButton.innerHTML = "&times;";
  closeButton.style.position = "absolute";
  closeButton.style.top = "20px";
  closeButton.style.right = "30px";
  closeButton.style.fontSize = "40px";
  closeButton.style.color = "#fff";
  closeButton.style.cursor = "pointer";

  closeButton.onclick = () => {
    document.body.removeChild(modal);
  };

  // Close modal when clicking outside the image
  modal.onclick = (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  };

  modal.appendChild(img);
  modal.appendChild(closeButton);
  document.body.appendChild(modal);
}

// Initialize the widget
document.addEventListener("DOMContentLoaded", async () => {
  window.messagingWidget = await new MessagingWidget();
});

async function getUserAlbums() {
  const response = await fetch("https://localhost:3000/v1/collection/list", {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    credentials: "include",
  });

  if (response.ok) {
    const data = await response.json();
    return data;
  }

  return [];
}

async function ensureAlbumExists() {
  const album = await getUserAlbums();

  if (album.length > 0) {
    return album[0].id;
  }

  const response = await fetch("https://localhost:3000/v1/collection/create", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: JSON.stringify({
      title: "Messenger Images",
    }),
  });

  if (response.ok) {
    const data = await response.json();
    return data.id;
  }

  return null;
}

async function uploadImage(url) {
  if (!url) {
    console.error("No image URL provided");
    return;
  }

  const albumId = await ensureAlbumExists();
  if (!albumId) {
    console.error("Failed to create album");
    return;
  }

  const response = await fetch("https://localhost:3000/v1/photo/create", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: JSON.stringify({
      url: url,
      caption: "Image uploaded from messenger",
      albumIds: [albumId],
    }),
  });

  if (response.ok) {
    const data = await response.json();
    return data.url;
  }

  return null;
}
