// the only bridge the Buddy page gets: a handful of window/data calls, no Node access
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("buddy", {
  getPerson: () => ipcRenderer.invoke("buddy:getPerson"),
  getData: () => ipcRenderer.invoke("buddy:getData"),
  getBounds: () => ipcRenderer.invoke("buddy:getBounds"),
  setPeople: (list) => ipcRenderer.send("buddy:setPeople", list),
  setBadge: (n, nick) => ipcRenderer.send("buddy:setBadge", n, nick),
  setInteractive: (on) => ipcRenderer.send("buddy:interactive", !!on),
  moveBy: (dx, dy) => ipcRenderer.send("buddy:moveBy", dx, dy),
  moveTo: (x) => ipcRenderer.send("buddy:moveTo", x),
  openHub: () => ipcRenderer.send("buddy:openHub"),
  showMenu: () => ipcRenderer.send("buddy:showMenu"),
  cmd: (name, arg) => ipcRenderer.invoke("buddy:cmd", name, arg),
  onPerson: (fn) => ipcRenderer.on("buddy:person", (e, n) => fn(n))
});
