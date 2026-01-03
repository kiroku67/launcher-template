const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // 🔐 Authentication
  checkToken: () => ipcRenderer.invoke('check-token'),
  authenticate: (token) => ipcRenderer.invoke('authenticate', token),
  logout: () => ipcRenderer.invoke('logout'),
  updateToken: (newToken) => ipcRenderer.invoke('update-token', newToken),
  
  // 📡 Repository
  getRepoInfo: () => ipcRenderer.invoke('get-repo-info'),
  
  // 🎯 Servers
  listServers: () => ipcRenderer.invoke('list-servers'),
  saveLastServer: (serverId) => ipcRenderer.invoke('save-last-server', serverId),
  getServerMetadata: (serverId) => ipcRenderer.invoke('get-server-metadata', serverId),
  updateServerMetadata: (serverId, metadata) => ipcRenderer.invoke('update-server-metadata', serverId, metadata),
  
  // 📂 Files
  listFiles: (params) => ipcRenderer.invoke('list-files', params),
  uploadFile: (params) => ipcRenderer.invoke('upload-file', params),
  deleteFile: (params) => ipcRenderer.invoke('delete-file', params),
  moveFile: (params) => ipcRenderer.invoke('move-file', params),
  getFileContent: (filePath) => ipcRenderer.invoke('get-file-content', filePath),
  
  // 📦 Batch operations
  batchCommit: (params) => ipcRenderer.invoke('batch-commit', params)
});
