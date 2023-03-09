const { app, BrowserWindow, ipcMain, dialog, Menu, MenuItem, shell } = require('electron')
const process = require('process');
const path = require('path')
const http = require('http');
const net = require('net');
const fs = require('fs');
console.log(app.getAppPath())
yukon_server_port = process.env.YUKON_SERVER_PORT;
function getYukonVersion() {
    const version_file_path = path.join(app.getAppPath(), "..", "version.py");
    console.log("Version file path: " + version_file_path);
    const version_file_exists = fs.existsSync(version_file_path);
    if (version_file_exists) {
        const version_file_contents = fs.readFileSync(version_file_path, 'utf8');
        console.log("Version file contents: " + version_file_contents);
        const version_regex = /__version__ = "(\d+\.\d+\.\d+)"/m;
        const version = version_file_contents.match(version_regex)[1];
        return version;
    }
    return "0.0.0";
}
function createWindow() {
    const yukon_version = getYukonVersion();
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(app.getAppPath(), "icon_128_128.png"),
        title: "Yukon " + yukon_version
    })
    win.setBackgroundColor('#000')
    // Get the environment variable YUKON_SERVER_PORT
    const url = `http://127.0.0.1:${yukon_server_port}/main/main.html?port=${yukon_server_port}`
    console.log("Yukon server port: " + process.env.YUKON_SERVER_PORT);
    console.log("Yukon server URL: " + url);
    // Add the port to the loadURL below
    win.loadURL(url);
    win.maximize();
    win.webContents.on('context-menu', (_, props) => {
        const menu = new Menu();
        menu.append(new MenuItem({ label: 'Cut', role: 'cut' }));
        menu.append(new MenuItem({ label: 'Copy', role: 'copy' }));
        if (props.isEditable) {
            menu.append(new MenuItem({ label: 'Paste', role: 'paste' }));
        }
        menu.popup();
    });
    // https://www.electronjs.org/docs/latest/api/window-open
    // https://www.electronjs.org/docs/latest/api/browser-window
    win.webContents.setWindowOpenHandler((details) => {
        console.log("details: " + JSON.stringify(details))
        let the_title = "Yukon " + getYukonVersion();
        // If get_all_subscription_messages is in details.url then, the title is "Yukon - Subscription log viewer"
        // Extract the message_specifier=7509 from details.url and set the title to "Yukon - 7509"
        if (details.url.includes("get_all_subscription_messages")) {
            // Use regex to extract the one occurence of message_specifier
            const regex = /message_specifier=(\d+)/m;
            the_title = `${details.url.match(regex)[1]} - Subscription log viewer`;
        } else if (details.url.includes("get_latest_subscription_message")) {
            const regex = /message_specifier=(\d+)/m;
            the_title = `${details.url.match(regex)[1]} - Subscription latest message (no auto refresh, press CTRL+R to refresh)`;
        }
        return {
            action: 'allow',
            overrideBrowserWindowOptions: {
                backgroundColor: 'white',
                icon: path.join(app.getAppPath(), "icon_128_128.png"),
                transparent: true,
                darkTheme: true,
                title: the_title
            }
        }
    })
    return win;
}

const isMac = process.platform === 'darwin'
const restoreDefaultLayoutItem = {
    label: "Restore default layout",
};
let menuTemplate = [
    {
        label: 'File',
        submenu: [
            isMac ? { role: 'close' } : { role: 'quit' }
        ]
    },
    {
        label: 'View',
        submenu: [
            { role: 'reload' },
            { role: 'forceReload' },
            { role: 'toggleDevTools' },
            { type: 'separator' },
            { role: 'resetZoom' },
            { role: 'zoomIn' },
            { role: 'zoomOut' },
            { type: 'separator' },
            { role: 'togglefullscreen' },
            restoreDefaultLayoutItem
        ]
    },
    {
        label: "Help",
        // Create a menu item that will open the %HOME%/.yukon folder
        submenu: [
            {
                label: "Links, directories",
                // Create a menu item that will open the %HOME%/.yukon folder
                submenu: [
                    {
                        label: "Open Yukon logs folder",
                        click: async () => {
                            const home_dir = app.getPath('home');
                            const yukon_home_dir = path.join(home_dir, ".zubax", "yukon", "logs");
                            const yukon_home_dir_exists = fs.existsSync(yukon_home_dir);
                            if (yukon_home_dir_exists) {
                                // Open the folder
                                await shell.showItemInFolder(yukon_home_dir)
                            }
                        }
                    },
                    {
                        label: "Open Cyphal DSDL source folder",
                        click: async () => {
                            const home_dir = app.getPath('home');
                            const yukon_home_dir = path.join(home_dir, ".cyphal");
                            const yukon_home_dir_exists = fs.existsSync(yukon_home_dir);
                            if (yukon_home_dir_exists) {
                                // Open the folder
                                await shell.showItemInFolder(yukon_home_dir)
                            }
                        }
                    },
                    {
                        label: "Open compiled DSDL folder",
                        click: async () => {
                            const home_dir = app.getPath('home');
                            const yukon_home_dir = path.join(home_dir, ".pycyphal");
                            const yukon_home_dir_exists = fs.existsSync(yukon_home_dir);
                            if (yukon_home_dir_exists) {
                                // Open the folder
                                await shell.showItemInFolder(yukon_home_dir)
                            }
                        }
                    },
                    // Create a menu item that will print the version number of Yukon from ../version.py
                    {
                        label: "Browse application directory of Yukon",
                        click: async () => {
                            await shell.showItemInFolder(app.getAppPath())
                        }
                    },
                    {
                        label: "Open Yukon in a web browser",
                        click: async () => {
                            const url = `http://127.0.0.1:${yukon_server_port}/main/main.html?port=${yukon_server_port}`
                            shell.openExternal(url);
                        }
                    },
                    {
                        label: "Open Yukon download webpage",
                        click: async () => {
                            const url = `https://files.zubax.com/products/org.opencyphal.yukon/releases/`
                            shell.openExternal(url);
                        }
                    },
                    {
                        label: "Open OpenCyphal forum",
                        click: async () => {
                            const url = `https://forum.opencyphal.org/`
                            shell.openExternal(url);
                        }
                    },
                    {
                        label: "Open the Yukon category in the OpenCyphal forum",
                        click: async () => {
                            const url = `https://forum.opencyphal.org/c/app/yukon/14`
                            shell.openExternal(url);
                        }
                    },
                ]
            },
            {
                label: "About",
                click: async () => {
                    const yukon_version = getYukonVersion();
                    console.log("Yukon version: " + yukon_version);
                    dialog.showMessageBoxSync({
                        type: "info",
                        title: "About Yukon",
                        message: "Yukon version: " + yukon_version + "\n" + "Forum for asking questions: https://forum.opencyphal.org/"
                    });
                }
            },
        ]
    },

]
app.whenReady().then(() => {
    // Send a GET request to http://locahost:5000/api/announce_running_in_electron
    // to announce that the app is running in electron
    http.get(`http://localhost:${yukon_server_port}/api/announce_running_in_electron`, (resp) => {
    });
    console.log("Announcing that running in electron")
    ipcMain.handle('dialog:openPath', handlePathOpen);
    ipcMain.handle('dialog:saveFile', handleFileSave);
    const window = createWindow();
    restoreDefaultLayoutItem.click = async () => {
        await window.webContents.send('restore_default_layout')
        removeAllRecoverButtons();
    }
    console.log("Setting up IPC handlers");
    const menu = Menu.buildFromTemplate(menuTemplate);
    ipcMain.handle('panels:addRecovery', function (_, panelName, panelText) {
        console.log("Adding recoverable panel: " + panelName + " " + panelText);
        addRecoverablePanel(panelName, panelText, window, menu);
    }, window);
    ipcMain.handle('panels:removeRecovery', function (_, panelText) {
        console.log("Removing recoverable panel: " + panelText);
        removeRecoverButton(panelText);
    });
    Menu.setApplicationMenu(menu)
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        http.get(`http://localhost:${yukon_server_port}/api/close_yukon`, (resp) => {
        });
        app.quit();
    }
})
const panelsText = "Open panels"
function addRecoverablePanel(panelName, panelText, window, menu) {
    const newItem = {
        label: panelText,
        enabled: true,
        async click() { await window.webContents.send('panels:recover', panelName) }
    }
    if (!menuTemplate.find(x => x.label === panelsText)) {
        menuTemplate.push(
            {
                label: panelsText,
                submenu: [
                    newItem
                ]
            }
        );
        const new_menu = Menu.buildFromTemplate(menuTemplate)
        Menu.setApplicationMenu(new_menu);
    } else {
        menuTemplate.find(x => x.label === panelsText).submenu.push(newItem);
        const new_menu = Menu.buildFromTemplate(menuTemplate)
        Menu.setApplicationMenu(new_menu);
    }
}
function removeRecoverButton(panelText) {
    const panelsMenuTemplate = menuTemplate.find(x => x.label === panelsText);
    panelsMenuTemplate.submenu = panelsMenuTemplate.submenu.filter(x => x.label !== panelText);
    if (panelsMenuTemplate.submenu.length === 0) {
        menuTemplate.splice(menuTemplate.indexOf(panelsMenuTemplate), 1);
    }
    const new_menu = Menu.buildFromTemplate(menuTemplate)
    Menu.setApplicationMenu(new_menu);
}
function removeAllRecoverButtons() {
    try {
        menuTemplate.splice(menuTemplate.indexOf(panelsMenuTemplate), 1);
    } catch (e) {
    }
    const new_menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(new_menu);
}

async function handleFileSave(_, content) {
    const { canceled, filePath } = await dialog.showSaveDialog();
    if (canceled) {
        return;
    } else {
        fs.writeFileSync(filePath, content);
    }
}

async function handlePathOpen(_, properties) {
    const { canceled, filePaths } = await dialog.showOpenDialog(properties);
    if (canceled) {
        return;
    } else {
        return filePaths[0];
    }
}
