const { contextBridge, ipcRenderer } = require('electron')
window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector)
        if (element) element.innerText = text
    }

    for (const type of ['chrome', 'node', 'electron']) {
        replaceText(`${type}-version`, process.versions[type])
    }
})

contextBridge.exposeInMainWorld('electronAPI', {
    openPath: (properties) => ipcRenderer.invoke('dialog:openPath', properties),
    saveFile: (content) => ipcRenderer.invoke('dialog:saveFile', content),
    addRecoverablePanel: (callback) => ipcRenderer.invoke('panels:addRecovery', callback),
    onOpenSettings: (callback) => ipcRenderer.on('openSettings', callback)
})