const { app, BrowserWindow, Menu, dialog, ipcMain, protocol, session } = require("electron");
const { join } = require("node:path");
const { writeFile } = require("node:fs/promises");
const { assetHandler, origin } = require("./protocol.cjs");

protocol.registerSchemesAsPrivileged([{ scheme: "georisiko", privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true
} }]);
app.commandLine.appendSwitch("disable-background-networking");
app.commandLine.appendSwitch("disable-component-update");
app.commandLine.appendSwitch("disable-sync");
app.enableSandbox();
let window, localSession, measuring = false;

function togglePresentation() {
  if (window) window.setFullScreen(!window.isFullScreen());
}
function createWindow() {
  if (window) { window.show(); return; }
  const win = new BrowserWindow({ title: "GeoRisiko", width: 1366, height: 850, minWidth: 740, minHeight: 530,
    backgroundColor: "#0a1318", show: false, webPreferences: {
      session: localSession, preload: join(__dirname, "preload.cjs"), sandbox: true, contextIsolation: true,
      nodeIntegration: false, webSecurity: true, webviewTag: false, devTools: false, spellcheck: false
    } });
  window = win;
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-frame-navigate", event => {
    if (!event.isMainFrame || event.url !== origin + "/") event.preventDefault();
  });
  for (const event of ["enter-full-screen", "leave-full-screen"]) win.on(event, () =>
    win.webContents.send("presentation:state", win.isFullScreen()));
  win.once("ready-to-show", () => win.show());
  win.on("closed", () => { if (window === win) window = undefined; });
  win.loadURL(origin + "/").catch(error => dialog.showErrorBox("GeoRisiko konnte nicht starten", error.message));
}

async function deviceProbe(milliseconds) {
  if (!window || measuring) return;
  const win = window;
  measuring = true;
  try {
    const before = app.getAppMetrics();
    const report = await win.webContents.executeJavaScript("window.geoDeviceProbe("+milliseconds+")");
    const after = app.getAppMetrics();
    const { arch, versions } = process;
    const result = { ...report, arch, macOS: process.getSystemVersion(), electron: versions.electron,
      gpu: app.getGPUFeatureStatus(), processes: after.map(p => {
        const start = before.find(q => q.pid === p.pid);
        return { type: p.type, cpuSeconds: start ? p.cpu.cumulativeCPUUsage - start.cpu.cumulativeCPUUsage : null,
          workingSetKiB: p.memory.workingSetSize };
      }) };
    const { response } = await dialog.showMessageBox(win, { type: "info", message: "Geräteprüfung abgeschlossen",
      detail: report.fps.toFixed(1) + " Bilder/s · P95 " + report.p95.toFixed(1) + " ms · längste Bildpause " + report.max.toFixed(1) + " ms",
      buttons: ["Schließen", "JSON sichern …"] });
    if (response === 1) {
      const {filePath} = await dialog.showSaveDialog(win,{defaultPath:"GeoRisiko-Geraetepruefung.json",filters:[{name:"JSON",extensions:["json"]}]});
      if (filePath) await writeFile(filePath, JSON.stringify(result,null,2));
    }
  } catch (error) { if (!win.isDestroyed()) dialog.showErrorBox("Geräteprüfung",error.message); }
  finally { measuring = false; }
}
function menu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label:"GeoRisiko", submenu:[{role:"about",label:"Über GeoRisiko"},{type:"separator"},{role:"hide",label:"GeoRisiko ausblenden"},{role:"unhide",label:"Alle einblenden"},{type:"separator"},{role:"quit",label:"GeoRisiko beenden"}] },
    { label:"Ansicht", role:"windowMenu", submenu:[{label:"Modellfenster öffnen",accelerator:"CmdOrCtrl+O",click:createWindow},{role:"minimize",label:"Im Dock ablegen"},{role:"zoom",label:"Fenstergröße ändern"},{role:"front",label:"Alle Fenster nach vorne"},{role:"close",label:"Fenster schließen"}] },
    { label:"Präsentation", submenu:[{label:"Vollbild wechseln",accelerator:"Control+Command+F",click:togglePresentation}] },
    { label:"Hilfe", submenu:[{label:"Modellhinweise und Quellen",click:()=>window?.webContents.executeJavaScript("document.getElementById('info').click()")},
      {label:"Kurzprüfung (10 Sekunden)",click:()=>deviceProbe(10000)},
      {label:"Ausführliche Unterrichtsprüfung (15 Minuten)",click:()=>deviceProbe(900000)}] }
  ]));
}
app.whenReady().then(async () => {
  localSession = session.fromPartition("persist:georisiko-classroom",{cache:false});
  localSession.setPermissionRequestHandler((_wc,_p,callback)=>callback(false));
  localSession.setPermissionCheckHandler(()=>false);
  localSession.webRequest.onBeforeRequest({urls:["http://*/*","https://*/*","ws://*/*","wss://*/*","file://*/*"]}, (_r,done)=>done({cancel:true}));
  await localSession.protocol.handle("georisiko",await assetHandler(join(app.getAppPath(),"dist")));
  ipcMain.handle("presentation:toggle", event => {
    if (window && event.sender === window.webContents && event.senderFrame === event.sender.mainFrame &&
        event.senderFrame.url === origin + "/") togglePresentation();
  });
  menu(); createWindow(); app.on("activate", createWindow);
}).catch(error=>{dialog.showErrorBox("GeoRisiko",error.message);app.exit(1);});
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit();});
