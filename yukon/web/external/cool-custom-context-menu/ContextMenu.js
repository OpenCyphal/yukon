class ContextMenu {
    constructor({target = null, menuItems = [], mode = "dark"}) {
        this.dataOfMenuElements = new WeakMap();
        this.target = target;
        this.menuItems = menuItems;
        this.mode = mode;
        this.menuElementsArray = this.getMenuItemsNode();
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
            const element = this.createElementMarkup(data);
            this.dataOfMenuElements.set(element, data);
            if (!data.shouldBeDisplayed) {
                data.shouldBeDisplayed = () => true;
            }
            element.firstChild.setAttribute(
                "style",
                `animation-delay: ${index * 0.01}s`
            );
            nodes.push(element);
        });

        return nodes;
    }

    createElementMarkup(data) {
        const button = document.createElement("BUTTON");
        const element = document.createElement("LI");

        button.innerHTML = data.content;
        button.classList.add("contextMenu-button");
        element.classList.add("contextMenu-item");

        if (data.divider) element.setAttribute("data-divider", data.divider);
        element.appendChild(button);
        const contextMenuThis = this;
        if (data.events && data.events.length !== 0) {
            Object.entries(data.events).forEach((event) => {
                const [key, value] = event;
                if (key === "adjust") {
                    if(contextMenuThis.executeOnOpen) {
                        contextMenuThis.executeOnOpen.push(function() {value(contextMenuThis, element, button);});
                    } else {
                        contextMenuThis.executeOnOpen = [function() {value(contextMenuThis, element, button);}];
                    }
                } else {
                    function wrapper(e) {
                        value(e, contextMenuThis.elementOpenedOn);
                        contextMenuThis.closeMenu(contextMenuThis.renderedMenu);
                    }

                    button.addEventListener(key, wrapper);
                }

            });
        }

        return element;
    }

    renderMenu() {
        const menuContainer = document.createElement("UL");

        menuContainer.classList.add("contextMenu");
        menuContainer.setAttribute("data-theme", this.mode);

        this.menuElementsArray.forEach((item) => {
            if (this.dataOfMenuElements.get(item).shouldBeDisplayed()) {
                if (this.dataOfMenuElements.get(item).nameChangeNeeded) {
                    this.dataOfMenuElements.get(item).nameChangeNeeded();
                }
                menuContainer.appendChild(item)
            }
        });

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
        document.addEventListener("click", () => {
            this.closeMenu(this.renderedMenu)
        });
        window.addEventListener("blur", () => this.closeMenu(this.renderedMenu));
        // When escape is pressed, close the menu
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                this.closeMenu(this.renderedMenu);
            }
        });
        document.addEventListener("contextmenu", (e) => {
            // If e.target starts with a . then check if the classList contains the target, if e.target starts with a # then check if the id is the target
            const isId = this.target[0] === "#";
            const isClass = this.target[0] === ".";
            if ((isClass && e.target.classList.contains(this.target.substring(1))) || (isId && e.target.id === this.target.substring(1))) {
                this.closeMenu(this.renderedMenu)
                e.preventDefault();
                this.renderedMenu = this.renderMenu();

                this.elementOpenedOn = e.target;
                if (this.executeOnOpen) {
                    this.executeOnOpen.forEach((func) => func());
                }
                this.isOpened = true;

                const {clientX, clientY} = e;
                document.body.appendChild(this.renderedMenu);

                const positionY =
                    clientY + this.renderedMenu.scrollHeight >= window.innerHeight
                        ? window.innerHeight - this.renderedMenu.scrollHeight - 20
                        : clientY;
                const positionX =
                    clientX + this.renderedMenu.scrollWidth >= window.innerWidth
                        ? window.innerWidth - this.renderedMenu.scrollWidth - 20
                        : clientX;

                setTimeout(() => {
                    this.renderedMenu.setAttribute(
                        "style",
                        `--width: ${this.renderedMenu.scrollWidth}px;
            --height: ${this.renderedMenu.scrollHeight}px;
            --top: ${positionY}px;
            --left: ${positionX}px;`
                    );
                }, 100);
            } else {
                // The original browser context menu is not shown
                this.closeMenu(this.renderedMenu);
            }
        });
    }
}
