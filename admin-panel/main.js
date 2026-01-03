const { app, BrowserWindow, ipcMain } = require('electron');
const { Octokit } = require('@octokit/rest');
const fs = require('fs');
const path = require('path');

// HARDCODED CONSTANTS - NO .env or config files
const REPO_OWNER = 'kiroku67';
const REPO_NAME = 'launcher-template';
const SERVER_ID = 'ExampleServer-1.20.1';
const BRANCH = 'main';

let mainWindow;
let octokit;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('authenticate', async (event, token) => {
  try {
    octokit = new Octokit({ auth: token });
    const { data } = await octokit.users.getAuthenticated();
    return { success: true, username: data.login };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('upload-mod', async (event, modData) => {
  try {
    const { filePath, modType } = modData;
    const fileName = path.basename(filePath);
    const content = fs.readFileSync(filePath, { encoding: 'base64' });
    
    // Determine path based on mod type (required, optionalon, optionaloff)
    const remotePath = `host/servers/${SERVER_ID}/forgemods/${modType}/${fileName}`;
    
    // Upload to GitHub
    await octokit.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: remotePath,
      message: `Add mod: ${fileName}`,
      content: content,
      branch: BRANCH
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-mod', async (event, modPath) => {
  try {
    // Get file SHA first
    const { data } = await octokit.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: modPath,
      ref: BRANCH
    });
    
    // Delete file
    await octokit.repos.deleteFile({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: modPath,
      message: `Remove mod: ${path.basename(modPath)}`,
      sha: data.sha,
      branch: BRANCH
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('list-mods', async () => {
  try {
    const modTypes = ['required', 'optionalon', 'optionaloff'];
    const allMods = {};
    
    for (const type of modTypes) {
      try {
        const { data } = await octokit.repos.getContent({
          owner: REPO_OWNER,
          repo: REPO_NAME,
          path: `host/servers/${SERVER_ID}/forgemods/${type}`,
          ref: BRANCH
        });
        
        allMods[type] = Array.isArray(data) ? data.map(file => ({
          name: file.name,
          path: file.path,
          size: file.size
        })) : [];
      } catch (error) {
        // Directory doesn't exist or is empty
        allMods[type] = [];
      }
    }
    
    return { success: true, mods: allMods };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
