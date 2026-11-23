const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("geoPresentation", {
  toggle: () => ipcRenderer.invoke("presentation:toggle"),
  onChange: listener => ipcRenderer.on("presentation:state", (_event, state) => listener(state))
});
