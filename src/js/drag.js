const style = document.createElement("style");
style.textContent = `
  .msg-widget {
    position: fixed;
    user-select: none; /* Prevent text selection while dragging */
  }

  .widget-header {
    cursor: move; /* Show move cursor on header */
  }
`;
document.head.appendChild(style);

// Dragging functionality
class DraggableChat {
  constructor() {
    this.widget = document.querySelector(".msg-widget");
    this.header = document.querySelector(".widget-header");
    this.isDragging = false;
    this.currentX = 0;
    this.currentY = 0;
    this.initialX = 0;
    this.initialY = 0;
    this.xOffset = 0;
    this.yOffset = 0;

    this.init();
  }

  init() {
    // Touch events
    this.header.addEventListener("touchstart", (e) => this.dragStart(e), false);
    document.addEventListener("touchend", (e) => this.dragEnd(e), false);
    document.addEventListener("touchmove", (e) => this.drag(e), false);

    // Mouse events
    this.header.addEventListener("mousedown", (e) => this.dragStart(e), false);
    document.addEventListener("mouseup", (e) => this.dragEnd(e), false);
    document.addEventListener("mousemove", (e) => this.drag(e), false);
  }

  dragStart(e) {
    if (e.type === "touchstart") {
      this.initialX = e.touches[0].clientX - this.xOffset;
      this.initialY = e.touches[0].clientY - this.yOffset;
    } else {
      this.initialX = e.clientX - this.xOffset;
      this.initialY = e.clientY - this.yOffset;
    }

    if (e.target === this.header || this.header.contains(e.target)) {
      this.isDragging = true;
    }
  }

  dragEnd(e) {
    this.initialX = this.currentX;
    this.initialY = this.currentY;
    this.isDragging = false;
  }

  drag(e) {
    if (this.isDragging) {
      e.preventDefault();

      if (e.type === "touchmove") {
        this.currentX = e.touches[0].clientX - this.initialX;
        this.currentY = e.touches[0].clientY - this.initialY;
      } else {
        this.currentX = e.clientX - this.initialX;
        this.currentY = e.clientY - this.initialY;
      }

      this.xOffset = this.currentX;
      this.yOffset = this.currentY;

      // Get window dimensions
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const widgetRect = this.widget.getBoundingClientRect();

      // Keep the widget within the window bounds
      const maxX = windowWidth - widgetRect.width;
      const maxY = windowHeight - widgetRect.height;

      this.xOffset = Math.min(Math.max(this.xOffset, 0), maxX);
      this.yOffset = Math.min(Math.max(this.yOffset, 0), maxY);

      this.setTranslate(this.xOffset, this.yOffset);
    }
  }

  setTranslate(xPos, yPos) {
    this.widget.style.transform = `translate(${xPos}px, ${yPos}px) !important`;
  }
}

// Initialize draggable functionality
document.addEventListener("DOMContentLoaded", () => {
  const draggableChat = new DraggableChat();
});
