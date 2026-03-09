const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('appInfo', {
  name: 'DancePlayer',
  version: '1.0.0',
});

contextBridge.exposeInMainWorld('musicApi', {
  selectMp3: () => ipcRenderer.invoke('music:select-file'),
  openProjectWindow: (audioSelection) => ipcRenderer.invoke('music:open-project-window', audioSelection),
  openClipWindow: (audioSelection) => ipcRenderer.invoke('music:open-clip-window', audioSelection),
  saveClipPart: (part) => ipcRenderer.send('clip:save-part', part),
  onPartSaved: (callback) => {
    const listener = (_event, part) => callback(part);
    ipcRenderer.on('clip:part-saved', listener);

    return () => {
      ipcRenderer.removeListener('clip:part-saved', listener);
    };
  },
});
