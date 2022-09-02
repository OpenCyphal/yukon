class ContextMenu {
  constructor({ target = null, menuItems = [], mode = "dark" }) {
    this.target = target;
    this.menuItems = menuItems;
    this.mode = mode;
    this.menuItemsNode = this.getMenuItemsNode();
    this.isOpened = false;
    this.elementOpenedOn = null;
    this.renderedMenu = null;
  }

  getMenuItemsNode() {
    const nodes = [];

    if (!this.menuItems) {
      console.error("getMenuItemsNode :: Please enter menu items");
      return [];
    }

    this.menuItems.forEach((data, index) => {
      const item = this.createItemMarkup(data);
      item.firstChild.setAttribute(
        "style",
        `animation-delay: ${index * 0.01}s`
      );
      nodes.push(item);
    });

    return nodes;
  }

  createItemMarkup(data) {
    const elementOpenedOn  = this.elementOpenedOn;
    const button = document.createElement("BUTTON");
    const item = document.createElement("LI");

    button.innerHTML = data.content;
    button.classList.add("contextMenu-button");
    item.classList.add("contextMenu-item");

    if (data.divider) item.setAttribute("data-divider", data.divider);
    item.appendChild(button);
    const contextMenuThis = this;
    if (data.events && data.events.length !== 0) {
      Object.entries(data.events).forEach((event) => {
        const [key, value] = event;
        function wrapper(e) { 
          value(e, contextMenuThis.elementOpenedOn);
          contextMenuThis.closeMenu(contextMenuThis.renderedMenu);
        }
        button.addEventListener(key, wrapper);
      });
    }

    return item;
  }

  renderMenu() {
    const menuContainer = document.createElement("UL");

    menuContainer.classList.add("contextMenu");
    menuContainer.setAttribute("data-theme", this.mode);

    this.menuItemsNode.forEach((item) => menuContainer.appendChild(item));

    return menuContainer;
  }

  closeMenu(menu) {
    if (this.isOpened) {
      this.isOpened = false;
      // Remove the html element menu
      document.body.removeChild(menu);
    }
  }

  init() {
    const contextMenu = this.renderMenu();
    this.renderedMenu = contextMenu;
    document.addEventListener("click", () => {console.log("Clicked"); this.closeMenu(contextMenu)});
    window.addEventListener("blur", () => this.closeMenu(contextMenu));
    // When escape is pressed, close the menu
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeMenu(contextMenu);
      }
    });
    document.addEventListener("contextmenu", (e) => {
      if(e.target.classList.contains(this.target)) {
        e.preventDefault();
        this.elementOpenedOn = e.target;
        this.isOpened = true;

        const { clientX, clientY } = e;
        document.body.appendChild(contextMenu);

        const positionY =
          clientY + contextMenu.scrollHeight >= window.innerHeight
            ? window.innerHeight - contextMenu.scrollHeight - 20
            : clientY;
        const positionX =
          clientX + contextMenu.scrollWidth >= window.innerWidth
            ? window.innerWidth - contextMenu.scrollWidth - 20
            : clientX;

        setTimeout(() => {
          contextMenu.setAttribute(
            "style",
            `--width: ${contextMenu.scrollWidth}px;
            --height: ${contextMenu.scrollHeight}px;
            --top: ${positionY}px;
            --left: ${positionX}px;`
          );
        }, 100); 
      } else {
        // The original browser context menu is not shown
        e.preventDefault();
        this.closeMenu(contextMenu);
      }
    });
  }
}
