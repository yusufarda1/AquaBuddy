import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('appBridge', {
  ping: () => ipcRenderer.invoke('ping'),
  notify: async ({ title, body }) => {
    const safeTitle = typeof title === 'string' ? title.slice(0, 120) : '';
    const safeBody = typeof body === 'string' ? body.slice(0, 500) : '';
    if (!safeTitle && !safeBody) return false;
    return ipcRenderer.invoke('notify', { title: safeTitle, body: safeBody });
  }
});
