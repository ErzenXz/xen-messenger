let userInfo = null;
let selectedUser = null;
let conversationInfo = null;
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
    // Handle file attachment here
    console.log("Files selected:", files);
    // Implement your file upload logic here
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
          <div class="user-item" data-username="${user.username}">
          <div>${user.username}</div>
          </div>
          `
        )
        .join("");

      this.userListContainer.querySelectorAll(".user-item").forEach((item) => {
        item.addEventListener("click", () =>
          this.startConversation(item.dataset.username)
        );
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
            conv.profileImage ||
            "https://icons-for-free.com/iff/png/512/facebook+profile+user+profile+icon-1320184041317225686.png"
          }" alt="${conv.username}" class="profile-image">
          <div class="conversation-items">
          <p class="conversation-fullName">${conv.fullName}</p>
          <p class="conversation-username">@${conv.username}</p>

          </div>
          <small>${conv.lastMessage || "No messages yet"}</small>
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

      const user = userInfo;
      this.messagesContainer.innerHTML = messages
        .map(
          (msg) => `
          <div class="message ${
            msg.senderId === user.id || msg.receiverId === user.id
              ? "sent"
              : "received"
          }">
          <div class="message-content">${msg.content}</div>
              <div class="message-time">${this.relativeTime(
                msg.timestamp
              )}</div>
          </div>
          `
        )
        .join("");

      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    } catch (error) {
      this.messagesContainer.innerHTML =
        '<div class="loading">Error loading messages</div>';
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
            <div class="message-content">${msg.content}</div>
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
      <div class="sent message">
        <div class="message-content">${content}</div>
        <div class="message-time">just now</div>
      </div>
      `;
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;

      if (response.ok) {
        this.messageForm.querySelector(".message-textbox").value = "";
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }

  async startConversation(username) {
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
            recipient: username,
            content: "",
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        this.currentConversation = data.conversationId;
        this.searchInput.value = "";
        this.showMessages();
        await this.loadMessages();
        await this.loadConversations();
      }
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

// Initialize the widget
document.addEventListener("DOMContentLoaded", async () => {
  window.messagingWidget = await new MessagingWidget();
});
