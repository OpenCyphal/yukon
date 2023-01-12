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
    addRecoverablePanel: (panelName, panelText) => ipcRenderer.invoke('panels:addRecovery', panelName, panelText),
    removeRecoverButton: (panelText) => ipcRenderer.invoke('panels:removeRecovery', panelText),
    onOpenSettings: (callback) => ipcRenderer.on('openSettings', callback),
    onRecoverPanel: (panelName) => ipcRenderer.on('panels:recover', panelName)
})