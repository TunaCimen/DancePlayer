const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  webContents,
} = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

let homeWindow = null;
const clipTargets = new Map();

ipcMain.handle('music:select-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'MP3 Audio', extensions: ['mp3'] }],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const selectedPath = result.filePaths[0];

  return {
    name: path.basename(selectedPath),
    fileUrl: pathToFileURL(selectedPath).toString(),
  };
});

function createHomeWindow() {
  homeWindow = new BrowserWindow({
    width: 960,
    height: 700,
    minWidth: 820,
    minHeight: 620,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  homeWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function createProjectWindow(audioSelection) {
  const projectWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  projectWindow.loadFile(path.join(__dirname, 'renderer', 'project.html'), {
    query: {
      fileUrl: audioSelection.fileUrl,
      name: audioSelection.name,
      projectName: audioSelection.projectName || audioSelection.name,
    },
  });

  return projectWindow;
}

function createClipWindow(parentWindow, audioSelection, targetWebContentsId) {
  const clipWindow = new BrowserWindow({
    width: 900,
    height: 680,
    minWidth: 760,
    minHeight: 560,
    parent: parentWindow,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const clipQuery = {
    fileUrl: audioSelection.fileUrl,
    name: audioSelection.name,
  };

  if (audioSelection.mode) {
    clipQuery.mode = String(audioSelection.mode);
  }

  if (typeof audioSelection.editIndex === 'number') {
    clipQuery.editIndex = String(audioSelection.editIndex);
  }

  if (audioSelection.partName) {
    clipQuery.partName = String(audioSelection.partName);
  }

  if (typeof audioSelection.startTime === 'number') {
    clipQuery.startTime = String(audioSelection.startTime);
  }

  if (typeof audioSelection.endTime === 'number') {
    clipQuery.endTime = String(audioSelection.endTime);
  }

  clipQuery.targetId = String(targetWebContentsId);

  clipWindow.loadFile(path.join(__dirname, 'renderer', 'clipper.html'), {
    query: clipQuery,
  });

  clipTargets.set(clipWindow.webContents.id, targetWebContentsId);

  clipWindow.on('closed', () => {
    clipTargets.delete(clipWindow.webContents.id);
  });
}

ipcMain.handle('music:open-project-window', async (_event, audioSelection) => {
  if (!audioSelection || !audioSelection.fileUrl || !audioSelection.name) {
    return false;
  }

  createProjectWindow(audioSelection);
  return true;
});

ipcMain.handle('music:open-clip-window', async (event, audioSelection) => {
  if (!audioSelection || !audioSelection.fileUrl || !audioSelection.name) {
    return false;
  }

  const parentWindow = BrowserWindow.fromWebContents(event.sender);

  if (!parentWindow) {
    return false;
  }

  createClipWindow(parentWindow, audioSelection, event.sender.id);
  return true;
});

ipcMain.on('clip:save-part', (event, part) => {
  const targetId = clipTargets.get(event.sender.id);

  if (!targetId) {
    return;
  }

  const targetWebContents = webContents.fromId(targetId);

  if (!targetWebContents || targetWebContents.isDestroyed()) {
    return;
  }

  targetWebContents.send('clip:part-saved', part);
});

app.whenReady().then(() => {
  createHomeWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createHomeWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
