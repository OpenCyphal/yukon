const {app, BrowserWindow, ipcMain, dialog, Menu} = require('electron')
const process = require('process');
const path = require('path')
const http = require('http');
const net = require('net');
const fs = require('fs');

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        },
        icon: "icon_128_128.png",
    })
    win.setBackgroundColor('#000')
    // Send a GET request to http://locahost:5000/api/announce_running_in_electron
    // to announce that the app is running in electron
    http.get('http://localhost:5000/api/announce_running_in_electron', (resp) => {
    });
    // Get the environment variable YUKON_SERVER_PORT
    const yukon_server_port = process.env.YUKON_SERVER_PORT;
    const url = `http://localhost:${yukon_server_port}/main/main.html`
    console.log("Yukon server port: " + process.env.YUKON_SERVER_PORT);
    console.log("Yukon server URL: " + url);
    // Add the port to the loadURL below
    win.loadURL(url);
    win.maximize();
    return win;
}

app.whenReady().then(() => {
    ipcMain.handle('dialog:openPath', handlePathOpen);
    ipcMain.handle('dialog:saveFile', handleFileSave);

    const isMac = process.platform === 'darwin'


    const window = createWindow();
    const template = [
        // { role: 'appMenu' }
        ...(isMac ? [{
            label: app.name,
            submenu: [
                {role: 'about'},
                {type: 'separator'},
                {role: 'services'},
                {type: 'separator'},
                {role: 'hide'},
                {role: 'hideOthers'},
                {role: 'unhide'},
                {type: 'separator'},
                {role: 'quit'}
            ]
        }] : []),
        // { role: 'fileMenu' }
        {
            label: 'File',
            submenu: [
                isMac ? {role: 'close'} : {role: 'quit'}
            ]
        },
        // { role: 'editMenu' }
        {
            label: 'Edit',
            submenu: [
                {role: 'undo'},
                {role: 'redo'},
                {type: 'separator'},
                {role: 'cut'},
                {role: 'copy'},
                {role: 'paste'},
                ...(isMac ? [
                    {role: 'pasteAndMatchStyle'},
                    {role: 'delete'},
                    {role: 'selectAll'},
                    {type: 'separator'},
                    {
                        label: 'Speech',
                        submenu: [
                            {role: 'startSpeaking'},
                            {role: 'stopSpeaking'}
                        ]
                    }
                ] : [
                    {role: 'delete'},
                    {type: 'separator'},
                    {role: 'selectAll'},
                    {type: 'separator'},
                    {
                        label: "Settings",
                        click: () => {
                            console.log("Going to emit openSettings");
                            window.webContents.send('openSettings')
                        }
                    }
                ])
            ]
        },
        // { role: 'viewMenu' }
        {
            label: 'View',
            submenu: [
                {role: 'reload'},
                {role: 'forceReload'},
                {role: 'toggleDevTools'},
                {type: 'separator'},
                {role: 'resetZoom'},
                {role: 'zoomIn'},
                {role: 'zoomOut'},
                {type: 'separator'},
                {role: 'togglefullscreen'}
            ]
        },
        // { role: 'windowMenu' }
        {
            label: 'Window',
            submenu: [
                {role: 'minimize'},
                {role: 'zoom'},
                ...(isMac ? [
                    {type: 'separator'},
                    {role: 'front'},
                    {type: 'separator'},
                    {role: 'window'}
                ] : [
                    {role: 'close'}
                ])
            ]
        },
        {
            role: 'help',
            submenu: [
                {
                    label: 'Learn More',
                    click: async () => {
                        const {shell} = require('electron')
                        await shell.openExternal('https://electronjs.org')
                    }
                }
            ]
        }
    ]

    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        http.get('http://localhost:5000/api/close_yukon', (resp) => {
        });
        app.quit();
    }
})

async function handleFileSave(_, content) {
    const {canceled, filePath} = await dialog.showSaveDialog();
    if (canceled) {
        return;
    } else {
        fs.writeFileSync(filePath, content);
    }
}

async function handlePathOpen(_, properties) {
    const {canceled, filePaths} = await dialog.showOpenDialog(properties);
    if (canceled) {
        return;
    } else {
        return filePaths[0];
    }
}
