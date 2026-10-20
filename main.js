// Guideline Buddy: a small always-on-top transparent window with the Guideline dog.
// The page and its data come live from the Guideline website, so changes reach everyone without reinstalling;
// a bundled copy (local/) and the last downloaded data are used when offline.
const { app, BrowserWindow, Tray, Menu, ipcMain, screen, shell, net, nativeImage } = require("electron");
const path = require("path"), fs = require("fs");
const SITE = "https://brand-hub-8story.hubsite.workers.dev/";
const MAC = process.platform === "darwin"; // dog (bottom, up to 150% size) + card space (top); empty parts let clicks through
let win = null, tray = null, people = [], cfgFile, cfg = { person: "", x: null };

if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", () => { if (win) win.showInactive(); });

function saveCfg() { try { fs.writeFileSync(cfgFile, JSON.stringify(cfg)); } catch (e) {} }
function place() {
  const a = screen.getPrimaryDisplay().workArea;
  const x = cfg.x == null ? a.x + a.width - W - 24 : Math.max(a.x, Math.min(cfg.x, a.x + a.width - W));
  win.setBounds({ x, y: a.y + a.height - H, width: W, height: H });
}
function create() {
  win = new BrowserWindow({
    width: W, height: H, frame: false, transparent: true, resizable: false, alwaysOnTop: true, skipTaskbar: true, hasShadow: false,
    focusable: true, show: false, backgroundColor: "#00000000",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, MAC ? { visibleOnFullScreen: true } : undefined);
  win.setIgnoreMouseEvents(true, { forward: true });
  place();
  win.loadURL(SITE + "buddy/?v=" + Date.now()).catch(() => win.loadFile(path.join(__dirname, "local", "index.html")));
  win.webContents.on("did-fail-load", (e, code, desc, url, isMain) => { if (isMain && !String(url).startsWith("file:")) win.loadFile(path.join(__dirname, "local", "index.html")); });
  win.once("ready-to-show", () => win.showInactive());
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
}
// "เปิด Guideline": the Guideline app installed from the website (Chrome/Edge app shortcut) if there is one,
// otherwise Guideline in its own app window (never a browser tab)
let hubWin = null;
function findHubShortcut() {
  const home = app.getPath("home"), roots = [app.getPath("desktop"), path.join(home, "OneDrive", "Desktop"), path.join(home, "Desktop"),
    path.join(app.getPath("appData"), "Microsoft", "Windows", "Start Menu", "Programs"), path.join(process.env.ProgramData || "C:\\ProgramData", "Microsoft", "Windows", "Start Menu", "Programs")];
  const walk = (d, depth) => { let out = null; try { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name);
    if (e.isFile() && /^Guideline.*8Story.*\.lnk$/i.test(e.name) && !/buddy/i.test(e.name)) return p;
    if (e.isDirectory() && depth > 0 && !out) out = walk(p, depth - 1); } } catch (er) {} return out; };
  if (MAC) { // Chrome/Edge put installed web apps in ~/Applications/Chrome Apps(.localized) / Edge Apps
  return null;
}
async function openHub() {
  const lnk = findHubShortcut();
  if (lnk) { const err = await shell.openPath(lnk); if (!err) return; }
  if (hubWin && !hubWin.isDestroyed()) { hubWin.show(); hubWin.focus(); return; }
  hubWin = new BrowserWindow({ width: 1280, height: 860, title: "Guideline · 8Story", icon: path.join(__dirname, "icon.png"), autoHideMenuBar: true, backgroundColor: "#F4F1EA", webPreferences: { contextIsolation: true, sandbox: true } });
  hubWin.loadURL(SITE);
  hubWin.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
}function menu() {
  const vid = people.filter((p) => p.dept !== "graphic"), gfx = people.filter((p) => p.dept === "graphic");
  const item = (p) => ({ label: p.nick + (p.nick !== p.name ? " (" + p.name + ")" : ""), type: "radio", checked: cfg.person === p.name, click: () => setPerson(p.name) });
  return Menu.buildFromTemplate([
    { label: "ให้น้องคอยบอกงานของ…", enabled: false },
    { label: "ทีมตัดต่อ", submenu: vid.length ? vid.map(item) : [{ label: "(กำลังโหลด)", enabled: false }] },
    { label: "ทีมกราฟฟิก", submenu: gfx.length ? gfx.map(item) : [{ label: "(กำลังโหลด)", enabled: false }] },
    { label: "ทุกคน (ภาพรวมทั้งทีม)", type: "radio", checked: cfg.person === "*", click: () => setPerson("*") },
    { type: "separator" },
    { label: "เปิด Guideline", click: () => openHub() },
    { label: "อัปเดตข้อมูลตอนนี้", click: () => win && win.webContents.reload() },
    { label: "กลับไปนั่งมุมขวาล่าง", click: () => { cfg.x = null; saveCfg(); place(); } },
    { label: MAC ? "เปิดพร้อมเครื่อง" : "เปิดพร้อม Windows", type: "checkbox", checked: app.getLoginItemSettings().openAtLogin, click: (m) => app.setLoginItemSettings({ openAtLogin: m.checked }) },
    { type: "separator" },
    { label: "ปิดผู้ช่วย", click: () => app.quit() }
  ]);
}
function setPerson(n) { cfg.person = n; saveCfg(); if (win) win.webContents.send("buddy:person", n); if (tray) tray.setContextMenu(menu()); }

ipcMain.handle("buddy:getPerson", () => cfg.person);
ipcMain.handle("buddy:cmd", (e, name, arg) => { // the page's own menu (v1.0.1)
  if (name === "setPerson") { cfg.person = String(arg || ""); saveCfg(); if (tray) tray.setContextMenu(menu()); return true; }
  if (name === "home") { cfg.x = null; saveCfg(); place(); return true; }
  if (name === "getLogin") return app.getLoginItemSettings().openAtLogin;
  if (name === "setLogin") { app.setLoginItemSettings({ openAtLogin: !!arg }); return !!arg; }
  if (name === "quit") { setTimeout(() => app.quit(), 50); return true; }
  return null;
});
ipcMain.handle("buddy:getData", async () => { // live feed, with the last good copy kept for offline use
  const cache = path.join(app.getPath("userData"), "buddy-cache.json");
  try { const r = await net.fetch(SITE + "buddy.json?v=" + Date.now(), { cache: "no-store" }); if (!r.ok) throw new Error(r.status); const t = await r.text(); JSON.parse(t); fs.writeFileSync(cache, t); return JSON.parse(t); }
  catch (e) { if (fs.existsSync(cache)) return JSON.parse(fs.readFileSync(cache, "utf8")); throw e; }
});
ipcMain.on("buddy:setPeople", (e, list) => { people = Array.isArray(list) ? list : []; if (tray) tray.setContextMenu(menu()); });
ipcMain.on("buddy:setBadge", (e, n, nick) => { if (tray) tray.setToolTip("Guideline Buddy" + (nick ? " · " + nick : "") + (n ? " · งานด่วน " + n : "")); });
ipcMain.on("buddy:interactive", (e, on) => { if (win) win.setIgnoreMouseEvents(!on, { forward: true }); });
ipcMain.on("buddy:moveBy", (e, dx, dy) => { if (!win) return; const b = win.getBounds(); win.setPosition(b.x + Math.round(dx), b.y + Math.round(dy)); cfg.x = b.x + Math.round(dx); saveCfg(); });
ipcMain.on("buddy:moveTo", (e, x) => { if (!win) return; const b = win.getBounds(); win.setPosition(Math.round(x), b.y); cfg.x = Math.round(x); });
ipcMain.handle("buddy:getBounds", () => ({ win: win.getBounds(), area: screen.getDisplayMatching(win.getBounds()).workArea }));
ipcMain.on("buddy:openHub", () => openHub());
ipcMain.on("buddy:showMenu", () => { const m = menu(); m.popup({ window: win }); });

app.whenReady().then(() => {
  if (MAC && app.dock) app.dock.hide(); // menu-bar helper, no Dock icon
  try { cfg = Object.assign(cfg, JSON.parse(fs.readFileSync(cfgFile, "utf8"))); } catch (e) {}
  if (!fs.existsSync(cfgFile)) { app.setLoginItemSettings({ openAtLogin: true }); saveCfg(); } // first run: start with Windows
  create();
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, "icon.png")).resize({ width: 16, height: 16 }));
  tray.setToolTip("Guideline Buddy"); tray.setContextMenu(menu());
  tray.on("double-click", () => openHub());
  screen.on("display-metrics-changed", place);
});
app.on("window-all-closed", () => app.quit());
