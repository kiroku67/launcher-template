const { app, BrowserWindow, ipcMain } = require('electron');
const { Octokit } = require('@octokit/rest');
const Store = require('electron-store');
const path = require('path');

// 💾 Persistent Storage
const store = new Store({
  encryptionKey: 'launcher-admin-panel-secret-key-2024'
});

// HARDCODED CONSTANTS
const REPO_OWNER = 'kiroku67';
const REPO_NAME = 'launcher-template';
const BRANCH = 'main';

let mainWindow;
let octokit;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    backgroundColor: '#0f1419',
    titleBarStyle: 'default',
    show: false
  });

  mainWindow.loadFile('index.html');
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// 🔐 Check if token exists
ipcMain.handle('check-token', async () => {
  const token = store.get('github-token');
  if (token) {
    octokit = new Octokit({ auth: token });
    try {
      // Verify token is valid
      await octokit.users.getAuthenticated();
      return { hasToken: true, token: token };
    } catch (error) {
      // Token invalid, clear it
      store.delete('github-token');
      return { hasToken: false };
    }
  }
  return { hasToken: false };
});

// 🔑 Authenticate
ipcMain.handle('authenticate', async (event, token) => {
  try {
    octokit = new Octokit({ auth: token });
    await octokit.users.getAuthenticated();
    
    // Save token
    store.set('github-token', token);
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 🚪 Logout
ipcMain.handle('logout', async () => {
  store.delete('github-token');
  store.delete('last-server');
  octokit = null;
  return { success: true };
});

// 💾 Update token
ipcMain.handle('update-token', async (event, newToken) => {
  try {
    const testOctokit = new Octokit({ auth: newToken });
    await testOctokit.users.getAuthenticated();
    
    store.set('github-token', newToken);
    octokit = testOctokit;
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 📡 Get repository info
ipcMain.handle('get-repo-info', async () => {
  return {
    owner: REPO_OWNER,
    repo: REPO_NAME,
    url: `https://github.com/${REPO_OWNER}/${REPO_NAME}`
  };
});

// 🎯 List servers
ipcMain.handle('list-servers', async () => {
  try {
    const { data } = await octokit.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'docs/servers',
      ref: BRANCH
    });
    
    const servers = data
      .filter(item => item.type === 'dir')
      .map(item => item.name);
    
    const lastServer = store.get('last-server');
    
    return { 
      success: true, 
      servers,
      lastServer: servers.includes(lastServer) ? lastServer : servers[0]
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 💾 Save last server
ipcMain.handle('save-last-server', async (event, serverId) => {
  store.set('last-server', serverId);
  return { success: true };
});

// 📂 List files by type and category
ipcMain.handle('list-files', async (event, { serverId, fileType, category }) => {
  try {
    let remotePath;
    
    if (fileType === 'forgemods') {
      remotePath = `docs/servers/${serverId}/forgemods/${category}`;
    } else if (fileType === 'files' && category) {
      // files with subdirectory (shaderpacks, resourcepacks, etc)
      remotePath = `docs/servers/${serverId}/files/${category}`;
    } else {
      remotePath = `docs/servers/${serverId}/${fileType}`;
    }
    
    try {
      const { data } = await octokit.repos.getContent({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        path: remotePath,
        ref: BRANCH
      });
      
      const files = Array.isArray(data) ? data.map(file => ({
        name: file.name,
        path: file.path,
        size: file.size,
        sha: file.sha
      })) : [];
      
      return { success: true, files };
    } catch (error) {
      // Directory doesn't exist or is empty
      if (error.status === 404) {
        return { success: true, files: [] };
      }
      throw error;
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 📤 Upload file
ipcMain.handle('upload-file', async (event, { serverId, fileType, category, fileName, fileData }) => {
  try {
    const buffer = Buffer.from(fileData);
    const content = buffer.toString('base64');
    
    let remotePath;
    if (fileType === 'forgemods') {
      remotePath = `docs/servers/${serverId}/forgemods/${category}/${fileName}`;
    } else if (fileType === 'files' && category) {
      // files with subdirectory (shaderpacks, resourcepacks, etc)
      remotePath = `docs/servers/${serverId}/files/${category}/${fileName}`;
    } else {
      remotePath = `docs/servers/${serverId}/${fileType}/${fileName}`;
    }
    
    await octokit.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: remotePath,
      message: `➕ Add ${fileType}: ${fileName}`,
      content: content,
      branch: BRANCH
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 🗑️ Delete file
ipcMain.handle('delete-file', async (event, { filePath, sha }) => {
  try {
    await octokit.repos.deleteFile({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: filePath,
      message: `🗑️ Delete ${path.basename(filePath)}`,
      sha: sha,
      branch: BRANCH
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 🔄 Move file (delete + create)
ipcMain.handle('move-file', async (event, { serverId, fileType, fileName, fromCategory, toCategory, sha, fileData }) => {
  try {
    // Build old path
    let oldPath;
    if (fileType === 'forgemods') {
      oldPath = `docs/servers/${serverId}/forgemods/${fromCategory}/${fileName}`;
    } else if (fileType === 'files' && fromCategory) {
      oldPath = `docs/servers/${serverId}/files/${fromCategory}/${fileName}`;
    } else {
      oldPath = `docs/servers/${serverId}/${fileType}/${fileName}`;
    }
    
    // Delete from old location
    await octokit.repos.deleteFile({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: oldPath,
      message: `🔄 Move ${fileName}: ${fromCategory} → ${toCategory}`,
      sha: sha,
      branch: BRANCH
    });
    
    // Build new path
    let newPath;
    if (fileType === 'forgemods') {
      newPath = `docs/servers/${serverId}/forgemods/${toCategory}/${fileName}`;
    } else if (fileType === 'files' && toCategory) {
      newPath = `docs/servers/${serverId}/files/${toCategory}/${fileName}`;
    } else {
      newPath = `docs/servers/${serverId}/${fileType}/${fileName}`;
    }
    
    // Create in new location
    const buffer = Buffer.from(fileData);
    const content = buffer.toString('base64');
    
    await octokit.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: newPath,
      message: `🔄 Move ${fileName}: ${fromCategory} → ${toCategory}`,
      content: content,
      branch: BRANCH
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 📦 Batch commit (submit all changes at once)
ipcMain.handle('batch-commit', async (event, { serverId, changes }) => {
  try {
    // Get reference to main branch
    const { data: ref } = await octokit.git.getRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `heads/${BRANCH}`
    });
    
    let baseSha = ref.object.sha;
    
    // Process large files (>1MB) separately to avoid tree API limits
    const largeFiles = changes.filter(c => 
      (c.action === 'add' || c.action === 'move') && 
      Buffer.from(c.fileData).length > 1024 * 1024
    );
    
    const regularChanges = changes.filter(c => 
      !(c.action === 'add' || c.action === 'move') || 
      Buffer.from(c.fileData).length <= 1024 * 1024
    );
    
    // Upload large files individually first
    for (const change of largeFiles) {
      try {
        const buffer = Buffer.from(change.fileData);
        const content = buffer.toString('base64');
        
        // Create blob
        const { data: blob } = await octokit.git.createBlob({
          owner: REPO_OWNER,
          repo: REPO_NAME,
          content: content,
          encoding: 'base64'
        });
        
        // Get current tree
        const { data: baseCommit } = await octokit.git.getCommit({
          owner: REPO_OWNER,
          repo: REPO_NAME,
          commit_sha: baseSha
        });
        
        // Create new tree with blob
        const { data: newTree } = await octokit.git.createTree({
          owner: REPO_OWNER,
          repo: REPO_NAME,
          base_tree: baseCommit.tree.sha,
          tree: [{
            path: change.path,
            mode: '100644',
            type: 'blob',
            sha: blob.sha
          }]
        });
        
        // Create commit
        const { data: newCommit } = await octokit.git.createCommit({
          owner: REPO_OWNER,
          repo: REPO_NAME,
          message: `${change.action === 'add' ? '➕ Add' : '🔄 Move'}: ${change.fileName || path.basename(change.path)}`,
          tree: newTree.sha,
          parents: [baseSha]
        });
        
        // Update reference
        await octokit.git.updateRef({
          owner: REPO_OWNER,
          repo: REPO_NAME,
          ref: `heads/${BRANCH}`,
          sha: newCommit.sha
        });
        
        baseSha = newCommit.sha;
      } catch (error) {
        console.error(`Error uploading large file ${change.fileName}:`, error);
        throw error;
      }
    }
    
    // Process regular changes
    if (regularChanges.length > 0) {
      const { data: baseCommit } = await octokit.git.getCommit({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        commit_sha: baseSha
      });
      
      const baseTreeSha = baseCommit.tree.sha;
      
      // Build tree objects for regular files
      const tree = [];
      
      for (const change of regularChanges) {
        if (change.action === 'add' || change.action === 'move') {
          const buffer = Buffer.from(change.fileData);
          
          // Create blob first for better handling
          const { data: blob } = await octokit.git.createBlob({
            owner: REPO_OWNER,
            repo: REPO_NAME,
            content: buffer.toString('base64'),
            encoding: 'base64'
          });
          
          tree.push({
            path: change.path,
            mode: '100644',
            type: 'blob',
            sha: blob.sha
          });
        } else if (change.action === 'delete') {
          tree.push({
            path: change.path,
            mode: '100644',
            type: 'blob',
            sha: null
          });
        }
      }
      
      // Create tree
      const { data: newTree } = await octokit.git.createTree({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        base_tree: baseTreeSha,
        tree: tree
      });
      
      // Create commit
      const commitMessage = `🎮 Batch update: ${regularChanges.length} changes\n\n${regularChanges.map(c => `${c.action}: ${c.fileName || path.basename(c.path)}`).join('\n')}`;
      
      const { data: newCommit } = await octokit.git.createCommit({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        message: commitMessage,
        tree: newTree.sha,
        parents: [baseSha]
      });
      
      // Update reference
      await octokit.git.updateRef({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        ref: `heads/${BRANCH}`,
        sha: newCommit.sha
      });
    }
    
    return { success: true };
  } catch (error) {
    console.error('Batch commit error:', error);
    return { success: false, error: error.message, response: error.response?.data };
  }
});

// 📋 Get server metadata
ipcMain.handle('get-server-metadata', async (event, serverId) => {
  try {
    const { data } = await octokit.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: `docs/servers/${serverId}/servermeta.json`,
      ref: BRANCH
    });
    
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    const metadata = JSON.parse(content);
    
    return { 
      success: true, 
      metadata,
      sha: data.sha 
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 💾 Update server metadata
ipcMain.handle('update-server-metadata', async (event, serverId, newMetadata) => {
  try {
    // Get current file to get SHA
    const { data: currentFile } = await octokit.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: `docs/servers/${serverId}/servermeta.json`,
      ref: BRANCH
    });
    
    const content = JSON.stringify(newMetadata, null, 2);
    const base64Content = Buffer.from(content).toString('base64');
    
    await octokit.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: `docs/servers/${serverId}/servermeta.json`,
      message: `⚙️ Update server settings for ${serverId}`,
      content: base64Content,
      sha: currentFile.sha,
      branch: BRANCH
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
