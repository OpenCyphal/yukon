const { app, BrowserWindow } = require('electron')
const process = require('process');
const path = require('path')

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js')
        },
        icon: "icon_128_128.png",
    })
    // Get the environment variable YUKON_SERVER_PORT
    const yukon_server_port = process.env.YUKON_SERVER_PORT;
    const url = `http://localhost:${yukon_server_port}/main/main.html`
    console.log("Yukon server port: " + process.env.YUKON_SERVER_PORT);
    console.log("Yukon server URL: " + url);
    // Add the port to the loadURL below
    win.loadURL(url)
    win.maximize();
}

app.whenReady().then(() => {
    createWindow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})