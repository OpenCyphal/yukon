class ContextMenu {
    constructor({ target = null, menuItems = [], mode = "dark" }) {
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
                if (key === "prepare") {
                    const function2 = function () { value(contextMenuThis, data); }
                    if (contextMenuThis.executeBeforeRender) {
                        contextMenuThis.executeBeforeRender.push(function2);
                    } else {
                        contextMenuThis.executeBeforeRender = [function2];
                    }
                } else if (key === "adjust") {
                    const function1 = function () { value(contextMenuThis, element, button, data); };
                    if (contextMenuThis.executeAfterRender) {
                        contextMenuThis.executeAfterRender.push(function1);
                    } else {
                        contextMenuThis.executeAfterRender = [function1];
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
            const dataOfItem = this.dataOfMenuElements.get(item);
            if (dataOfItem.shouldBeDisplayed() || !dataOfItem.shouldBeDisplayed) {
                if (dataOfItem.nameChangeNeeded) {
                    dataOfItem.nameChangeNeeded();
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
            const targetObject = e.target;
            const doesTargetMatchCriteria = targetObject.matches(this.target);
            if (doesTargetMatchCriteria) {
                // Close the previous Menu (no more than one context menu can be open at a time)
                this.closeMenu(this.renderedMenu)
                e.preventDefault();
                if (this.executeBeforeRender) {
                    this.executeBeforeRender.forEach((func) => func());
                }
                this.renderedMenu = this.renderMenu();
                if (this.executeAfterRender) {
                    this.executeAfterRender.forEach((func) => func());
                }

                this.elementOpenedOn = e.target;
                
                
                // If there are no elements remaining after the adjust function runs, don't show the menu
                if (this.renderedMenu.children.length === 0) {
                    return;
                }
                this.isOpened = true;

                const { clientX, clientY } = e;
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
