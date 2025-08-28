import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('appBridge', {
  ping: () => ipcRenderer.invoke('ping')
});
