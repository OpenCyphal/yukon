const { app, BrowserWindow, ipcMain, dialog, Menu, MenuItem } = require('electron')
const process = require('process');
const path = require('path')
const http = require('http');
const net = require('net');
const fs = require('fs');
console.log(app.getAppPath())
let yukon_server_port = 5000;  // This is not actually hard coded here, could've set it to null
function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(app.getAppPath(), "icon_128_128.png"),
    })
    win.setBackgroundColor('#000')
    // Get the environment variable YUKON_SERVER_PORT
    yukon_server_port = process.env.YUKON_SERVER_PORT;
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
        let the_title = "Yukon";
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
const menuTemplate = [
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
            { role: 'togglefullscreen' }
        ]
    },
]
app.whenReady().then(() => {
    // Send a GET request to http://locahost:5000/api/announce_running_in_electron
    // to announce that the app is running in electron
    http.get(`http://127.0.0.1:${yukon_server_port}/api/announce_running_in_electron`, (resp) => {
    });
    ipcMain.handle('dialog:openPath', handlePathOpen);
    ipcMain.handle('dialog:saveFile', handleFileSave);
    const window = createWindow();
    console.log("Setting up IPC handlers")
    const menu = Menu.buildFromTemplate(menuTemplate)
    ipcMain.handle('panels:addRecovery', function (_, panelName, panelText) {
        console.log("Adding recoverable panel: " + panelName + " " + panelText)
        addRecoverablePanel(panelName, panelText, window, menu);
    }, window);
    ipcMain.handle('panels:removeRecovery', function (_, panelText) {
        console.log("Removing recoverable panel: " + panelText)
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
