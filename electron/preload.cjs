const { contextBridge, ipcRenderer } = require('electron');
if (location.origin === 'https://interview-meet.mohitnaik.tech' && location.pathname === '/desktop/complete') {
  contextBridge.exposeInMainWorld('interviewDesktop', { takeCredential: () => ipcRenderer.invoke('desktop:credential') });
}
