const { app, BrowserWindow, ipcMain, dialog } = require('electron')
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
    // Send a GET request to http://locahost:5000/api/announce_running_in_electron
    // to announce that the app is running in electron
    http.get('http://localhost:5000/api/announce_running_in_electron', (resp) => { });
    // Get the environment variable YUKON_SERVER_PORT
    const yukon_server_port = process.env.YUKON_SERVER_PORT;
    const url = `http://localhost:${yukon_server_port}/main/main.html`
    console.log("Yukon server port: " + process.env.YUKON_SERVER_PORT);
    console.log("Yukon server URL: " + url);
    // Add the port to the loadURL below
    win.loadURL(url);
    win.maximize();
}

app.whenReady().then(() => {
    ipcMain.handle('dialog:openPath', handlePathOpen);
    ipcMain.handle('dialog:saveFile', handleFileSave);
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        http.get('http://localhost:5000/api/close_yukon', (resp) => { });
        app.quit();
    }
})
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
