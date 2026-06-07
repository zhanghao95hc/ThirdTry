const path = require('node:path');
const { app, BrowserWindow, Menu } = require('electron');

const iconPath = path.join(__dirname, '..', 'build', 'icon.ico');

function createWindow() {
  const win = new BrowserWindow({
    width: 1680,
    height: 1000,
    minWidth: 960,
    minHeight: 640,
    title: '双人卡牌对决',
    icon: iconPath,
    backgroundColor: '#071018',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
