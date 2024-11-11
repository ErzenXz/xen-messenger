class MessagingWidget {
  constructor() {
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

    this.currentConversation = null;
    this.searchTimeout = null;
    this.currentPage = 1;
    this.perPage = 20;

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
        `/searchUsers?query=${encodeURIComponent(query)}`
      );
      const users = await response.json();

      this.userListContainer.innerHTML = users
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

  async loadConversations() {
    try {
      this.conversationsContainer.innerHTML =
        '<div class="loading">Loading conversations...</div>';
      const response = await fetch("/conversations");
      const conversations = await response.json();

      this.conversationsContainer.innerHTML = conversations
        .map(
          (conv) => `
              <div class="conversation" data-id="${conv.id}">
                  <div>${conv.participant}</div>
                  <small>${conv.lastMessage || "No messages yet"}</small>
              </div>
          `
        )
        .join("");

      this.conversationsContainer
        .querySelectorAll(".conversation")
        .forEach((item) => {
          item.addEventListener("click", () =>
            this.openConversation(item.dataset.id)
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

  async openConversation(id) {
    this.currentConversation = id;
    this.currentPage = 1;
    this.showMessages();
    await this.loadMessages();
  }

  async loadMessages() {
    try {
      this.messagesContainer.innerHTML =
        '<div class="loading">Loading messages...</div>';
      const response = await fetch(
        `/conversations/${this.currentConversation}?page=${this.currentPage}&perPage=${this.perPage}`
      );
      const messages = await response.json();

      this.messagesContainer.innerHTML = messages
        .map(
          (msg) => `
              <div class="message ${msg.sent ? "sent" : "received"}">
                  <div class="message-content">${msg.content}</div>
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
        `/conversations/${this.currentConversation}?page=${
          this.currentPage + 1
        }&perPage=${this.perPage}`
      );
      const messages = await response.json();

      if (messages.length > 0) {
        this.currentPage++;
        const oldHeight = this.messagesContainer.scrollHeight;

        this.messagesContainer.insertAdjacentHTML(
          "afterbegin",
          messages
            .map(
              (msg) => `
                  <div class="message ${msg.sent ? "sent" : "received"}">
                      <div class="message-content">${msg.content}</div>
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
      const response = await fetch("/sendMessage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId: this.currentConversation,
          content,
        }),
      });

      if (response.ok) {
        this.messageForm.querySelector(".message-textbox").value = "";
        await this.loadMessages();
        await this.loadConversations();
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }

  async startConversation(username) {
    try {
      const response = await fetch("/sendMessage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipient: username,
          content: "",
        }),
      });

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

  showUserList() {
    this.conversationsContainer.style.display = "none";
    this.userListContainer.style.display = "block";
    this.messagesContainer.style.display = "none";
    this.messageInput.style.display = "none";
  }

  showConversations() {
    this.conversationsContainer.style.display = "block";
    this.userListContainer.style.display = "none";
    this.messagesContainer.style.display = "none";
    this.messageInput.style.display = "none";
  }

  showMessages() {
    this.conversationsContainer.style.display = "none";
    this.userListContainer.style.display = "none";
    this.messagesContainer.style.display = "block";
    this.messageInput.style.display = "block";
  }
}

// Initialize the widget
document.addEventListener("DOMContentLoaded", () => {
  window.messagingWidget = new MessagingWidget();
});
