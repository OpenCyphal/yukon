const { app, BrowserWindow } = require("electron")
function createWindow() {
    const transportWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true
        }
    })
    // Load the content of localhost:5000 to the window
    transportWindow.loadURL("http://localhost:5000");
    const monitorWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true
        }
    })
    monitorWindow.loadURL("http://localhost:5000/main");
}
app.whenReady().then(createWindow)
app.on("window - all - closed", () => {
    if (process.platform !== "darwin") {
        app.quit()
    }
});
app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})