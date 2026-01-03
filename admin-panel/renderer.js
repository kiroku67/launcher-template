// 🎮 Launcher Admin Panel V2 - Renderer Process

let currentServer = null;
let currentTab = 'mods';
let repoInfo = null;
let serverMetadata = null;
let allExistingFiles = []; // Track all files across all categories

// 📦 Staging system - accumulate changes before submitting
const pendingChanges = {
  new: [],      // Files to upload
  moved: [],    // Files moved between categories
  deleted: []   // Files to delete
};

// 🎨 Initialize app
async function init() {
  // Check if token exists
  const { hasToken, token} = await window.api.checkToken();
  
  if (hasToken) {
    // Auto-login
    document.getElementById('loginModal').classList.remove('active');
    document.getElementById('app').style.display = 'block';
    await loadApp();
  }
}

// 🔐 Handle login
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const token = document.getElementById('tokenInput').value.trim();
  
  if (!token) {
    alert('Please enter a token');
    return;
  }
  
  const result = await window.api.authenticate(token);
  
  if (result.success) {
    document.getElementById('loginModal').classList.remove('active');
    document.getElementById('app').style.display = 'block';
    await loadApp();
  } else {
    alert(`❌ Authentication failed: ${result.error}`);
  }
});

// 🚀 Load app after authentication
async function loadApp() {
  // Get repo info
  repoInfo = await window.api.getRepoInfo();
  document.getElementById('repoInfo').value = `${repoInfo.owner}/${repoInfo.repo}`;
  
  // Load servers
  await loadServers();
  
  // Setup UI
  setupTabs();
  setupUploadAreas();
  setupDragAndDrop();
  setupStatusBar();
  setupSettings();
  setupServerSettings();
}

// 🎯 Load servers
async function loadServers() {
  const result = await window.api.listServers();
  
  if (!result.success) {
    alert(`❌ Failed to load servers: ${result.error}`);
    return;
  }
  
  const select = document.getElementById('serverSelect');
  select.innerHTML = '';
  
  result.servers.forEach(server => {
    const option = document.createElement('option');
    option.value = server;
    option.textContent = server;
    select.appendChild(option);
  });
  
  // Select last used server or first one
  if (result.lastServer) {
    select.value = result.lastServer;
  }
  
  currentServer = select.value;
  
  // Load server metadata
  await loadServerMetadata();
  
  // Load files for current server
  await refreshAllFiles();
  
  // Listen for server changes
  select.addEventListener('change', async (e) => {
    currentServer = e.target.value;
    await window.api.saveLastServer(currentServer);
    clearPendingChanges();
    await loadServerMetadata();
    await refreshAllFiles();
  });
}

// 📋 Load server metadata
async function loadServerMetadata() {
  const result = await window.api.getServerMetadata(currentServer);
  
  if (result.success) {
    serverMetadata = result.metadata;
    
    // Update UI
    document.getElementById('settingServerName').value = serverMetadata.meta.name || '';
    document.getElementById('settingAddress').value = serverMetadata.meta.address || '';
    document.getElementById('settingDescription').value = serverMetadata.meta.description || '';
    document.getElementById('settingMainServer').checked = serverMetadata.meta.mainServer || false;
    document.getElementById('settingAutoconnect').checked = serverMetadata.meta.autoconnect || false;
  }
}

// 💾 Setup server settings
function setupServerSettings() {
  document.getElementById('saveServerSettingsBtn').addEventListener('click', async () => {
    const newMetadata = {
      ...serverMetadata,
      meta: {
        ...serverMetadata.meta,
        name: document.getElementById('settingServerName').value,
        address: document.getElementById('settingAddress').value,
        description: document.getElementById('settingDescription').value,
        mainServer: document.getElementById('settingMainServer').checked,
        autoconnect: document.getElementById('settingAutoconnect').checked
      }
    };
    
    const result = await window.api.updateServerMetadata(currentServer, newMetadata);
    
    if (result.success) {
      alert('✅ Server settings saved successfully!');
      serverMetadata = newMetadata;
    } else {
      alert(`❌ Failed to save settings: ${result.error}`);
    }
  });
}

// 📑 Setup tabs
function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      
      // Update tab buttons
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Update tab content
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(`${tabName}Tab`).classList.add('active');
      
      currentTab = tabName;
    });
  });
}

// 📤 Setup upload areas
function setupUploadAreas() {
  const uploadConfigs = [
    // Individual mod categories
    { area: 'uploadAreaRequired', input: 'fileInputRequired', type: 'forgemods', category: 'required', accept: '.jar' },
    { area: 'uploadAreaOptionalOn', input: 'fileInputOptionalOn', type: 'forgemods', category: 'optionalon', accept: '.jar' },
    { area: 'uploadAreaOptionalOff', input: 'fileInputOptionalOff', type: 'forgemods', category: 'optionaloff', accept: '.jar' },
    // Other types (now as files subdirectories)
    { area: 'uploadAreaShaders', input: 'fileInputShaders', type: 'files', category: 'shaderpacks', accept: '.zip' },
    { area: 'uploadAreaResourcepacks', input: 'fileInputResourcepacks', type: 'files', category: 'resourcepacks', accept: '.zip' },
    { area: 'uploadAreaFiles', input: 'fileInputFiles', type: 'files', category: '', accept: '*' }
  ];
  
  uploadConfigs.forEach(config => {
    const area = document.getElementById(config.area);
    const input = document.getElementById(config.input);
    
    if (!area || !input) return;
    
    // Click to upload
    area.addEventListener('click', () => input.click());
    
    // File input change
    input.addEventListener('change', (e) => {
      handleFileUpload(e.target.files, config.type, config.category);
      e.target.value = ''; // Reset input
    });
    
    // Drag and drop
    area.addEventListener('dragover', (e) => {
      e.preventDefault();
      area.classList.add('dragover');
    });
    
    area.addEventListener('dragleave', () => {
      area.classList.remove('dragover');
    });
    
    area.addEventListener('drop', (e) => {
      e.preventDefault();
      area.classList.remove('dragover');
      handleFileUpload(e.dataTransfer.files, config.type, config.category);
    });
  });
}

// 🗂️ Setup drag and drop between categories
function setupDragAndDrop() {
  let draggedItem = null;
  
  document.addEventListener('dragstart', (e) => {
    if (e.target.classList.contains('file-item')) {
      draggedItem = e.target;
      e.target.classList.add('dragging');
    }
  });
  
  document.addEventListener('dragend', (e) => {
    if (e.target.classList.contains('file-item')) {
      e.target.classList.remove('dragging');
    }
  });
  
  document.querySelectorAll('.category-body').forEach(category => {
    category.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (draggedItem && category.dataset.type === 'forgemods') {
        category.style.background = 'rgba(99, 102, 241, 0.1)';
      }
    });
    
    category.addEventListener('dragleave', () => {
      category.style.background = '';
    });
    
    category.addEventListener('drop', async (e) => {
      e.preventDefault();
      category.style.background = '';
      
      if (!draggedItem || category.dataset.type !== 'forgemods') return;
      
      const fromCategory = draggedItem.dataset.category;
      const toCategory = category.dataset.category;
      const fileName = draggedItem.dataset.filename;
      const filePath = draggedItem.dataset.filepath;
      const sha = draggedItem.dataset.sha;
      
      if (fromCategory === toCategory) return; // Same category
      
      // Add to pending changes
      addPendingChange('moved', {
        fileName,
        fromCategory,
        toCategory,
        filePath,
        sha,
        fileType: 'forgemods'
      });
      
      // Move visually
      category.appendChild(draggedItem);
      draggedItem.dataset.category = toCategory;
      draggedItem.classList.add('moved');
      
      updateCounts();
      updateStatusBar();
    });
  });
}

// 📊 Setup status bar
function setupStatusBar() {
  document.getElementById('discardBtn').addEventListener('click', () => {
    if (confirm('🚫 Discard all pending changes?')) {
      clearPendingChanges();
      refreshAllFiles();
    }
  });
  
  document.getElementById('submitBtn').addEventListener('click', async () => {
    await submitAllChanges();
  });
}

// ⚙️ Setup settings
function setupSettings() {
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsModal = document.getElementById('settingsModal');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const saveTokenBtn = document.getElementById('saveTokenBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  
  settingsBtn.addEventListener('click', async () => {
    const { token } = await window.api.checkToken();
    document.getElementById('currentToken').value = token ? '●●●●●●●●●●●●●●●●' : 'No token';
    settingsModal.classList.add('active');
  });
  
  closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('active');
    document.getElementById('newToken').value = '';
  });
  
  saveTokenBtn.addEventListener('click', async () => {
    const newToken = document.getElementById('newToken').value.trim();
    
    if (!newToken) {
      alert('Please enter a new token');
      return;
    }
    
    const result = await window.api.updateToken(newToken);
    
    if (result.success) {
      alert('✅ Token updated successfully!');
      settingsModal.classList.remove('active');
      document.getElementById('newToken').value = '';
    } else {
      alert(`❌ Failed to update token: ${result.error}`);
    }
  });
  
  logoutBtn.addEventListener('click', async () => {
    if (confirm('🚪 Logout and clear all data?')) {
      await window.api.logout();
      location.reload();
    }
  });
}

// 📂 Handle file upload
async function handleFileUpload(files, fileType, category) {
  if (!currentServer) {
    alert('Please select a server first');
    return;
  }
  
  const duplicates = [];
  const filesToUpload = [];
  const invalidFiles = [];
  
  for (const file of files) {
    // Validate file type
    if (fileType === 'forgemods' && !file.name.endsWith('.jar')) {
      alert(`❌ Invalid file type for mods: ${file.name}. Only .jar files allowed.`);
      continue;
    }
    
    if ((fileType === 'files' && (category === 'shaderpacks' || category === 'resourcepacks')) && !file.name.endsWith('.zip')) {
      alert(`❌ Invalid file type: ${file.name}. Only .zip files allowed.`);
      continue;
    }
    
    // Validate JAR files (check if it's a valid zip)
    if (fileType === 'forgemods') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        
        // Check ZIP magic number (PK\x03\x04)
        if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4B || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
          invalidFiles.push(file.name);
          continue;
        }
      } catch (error) {
        invalidFiles.push(file.name);
        continue;
      }
    }
    
    // Check for duplicates
    const isDuplicate = allExistingFiles.some(f => f.name === file.name && f.category === category);
    const isPendingNew = pendingChanges.new.some(f => f.fileName === file.name && f.category === category);
    
    if (isDuplicate || isPendingNew) {
      duplicates.push(file.name);
    } else {
      filesToUpload.push(file);
    }
  }
  
  // Show invalid files warning
  if (invalidFiles.length > 0) {
    alert(
      `❌ INVALID FILES DETECTED\n\n` +
      `The following files are corrupted or invalid:\n${invalidFiles.join('\n')}\n\n` +
      `These files were NOT added. Please re-download them from a trusted source.`
    );
  }
  
  // Show duplicate warning
  if (duplicates.length > 0) {
    const fileTypeName = fileType === 'forgemods' ? 'MODS' : 
                         (fileType === 'files' && category === 'shaderpacks') ? 'SHADERPACKS' :
                         (fileType === 'files' && category === 'resourcepacks') ? 'RESOURCE PACKS' : 'FILES';
    
    const confirmed = confirm(
      `⚠️ DUPLICATE ${fileTypeName} DETECTED\n\n` +
      `The following files already exist:\n${duplicates.join('\n')}\n\n` +
      `${fileType === 'forgemods' ? 'Uploading duplicate mods can crash Minecraft!' : 'These files will be overwritten!'}\n\n` +
      `Do you want to continue anyway?`
    );
    
    if (!confirmed) {
      return;
    }
    
    // User wants to continue, add duplicates back
    for (const file of files) {
      if (duplicates.includes(file.name)) {
        filesToUpload.push(file);
      }
    }
  }
  
  // Process files
  for (const file of filesToUpload) {
    // Read file
    const arrayBuffer = await file.arrayBuffer();
    const fileData = Array.from(new Uint8Array(arrayBuffer));
    
    // Add to pending changes
    addPendingChange('new', {
      fileName: file.name,
      fileData,
      fileType,
      category,
      size: file.size
    });
    
    // Add to UI immediately
    addFileToUI(fileType, category, {
      name: file.name,
      size: file.size,
      isNew: true
    });
  }
  
  updateCounts();
  updateStatusBar();
}

// 🔄 Refresh all files
async function refreshAllFiles() {
  if (!currentServer) return;
  
  allExistingFiles = [];
  
  // Refresh mods
  await refreshFiles('forgemods', 'required', 'requiredList');
  await refreshFiles('forgemods', 'optionalon', 'optionalonList');
  await refreshFiles('forgemods', 'optionaloff', 'optionaloffList');
  
  // Refresh other types (now as files subdirectories)
  await refreshFiles('files', 'shaderpacks', 'shadersList');
  await refreshFiles('files', 'resourcepacks', 'resourcepacksList');
  await refreshFiles('files', '', 'filesList');
  
  updateCounts();
}

// 📂 Refresh files for a specific category
async function refreshFiles(fileType, category, listId) {
  const result = await window.api.listFiles({
    serverId: currentServer,
    fileType,
    category
  });
  
  if (!result.success) {
    console.error(`Failed to load ${fileType}/${category}:`, result.error);
    return;
  }
  
  const list = document.getElementById(listId);
  list.innerHTML = '';
  
  if (result.files.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <div class="empty-state-text">No files yet</div>
        <div class="empty-state-hint">Upload files to get started</div>
      </div>
    `;
    return;
  }
  
  result.files.forEach(file => {
    allExistingFiles.push({ ...file, category });
    addFileToUI(fileType, category, file);
  });
}

// ➕ Add file to UI
function addFileToUI(fileType, category, file) {
  let listId;
  
  if (fileType === 'forgemods') {
    listId = `${category}List`;
  } else if (fileType === 'files' && category === 'shaderpacks') {
    listId = 'shadersList';
  } else if (fileType === 'files' && category === 'resourcepacks') {
    listId = 'resourcepacksList';
  } else if (fileType === 'files') {
    listId = 'filesList';
  }
  
  const list = document.getElementById(listId);
  
  if (!list) {
    console.error(`List element not found: ${listId}`);
    return;
  }
  
  // Remove empty state if exists
  const emptyState = list.querySelector('.empty-state');
  if (emptyState) emptyState.remove();
  
  const item = document.createElement('div');
  item.className = 'file-item';
  item.draggable = fileType === 'forgemods'; // Only mods can be dragged
  item.dataset.filename = file.name;
  item.dataset.filepath = file.path || '';
  item.dataset.sha = file.sha || '';
  item.dataset.category = category;
  item.dataset.filetype = fileType;
  
  if (file.isNew) {
    item.classList.add('new');
  }
  
  item.innerHTML = `
    <div class="file-info">
      <div class="file-name">${file.name}</div>
      <div class="file-size">${formatFileSize(file.size)}</div>
    </div>
    <div class="file-actions">
      <button onclick="deleteFile(this)" title="Delete">🗑️</button>
    </div>
  `;
  
  list.appendChild(item);
}

// 🗑️ Delete file
window.deleteFile = function(btn) {
  const item = btn.closest('.file-item');
  const fileName = item.dataset.filename;
  const filePath = item.dataset.filepath;
  const sha = item.dataset.sha;
  const fileType = item.dataset.filetype;
  
  if (item.classList.contains('new')) {
    // Remove from pending new files
    removePendingChange('new', fileName);
    item.remove();
  } else {
    // Mark for deletion
    addPendingChange('deleted', {
      fileName,
      filePath,
      sha,
      fileType
    });
    item.classList.add('deleted');
  }
  
  updateCounts();
  updateStatusBar();
};

// 📦 Add pending change
function addPendingChange(type, data) {
  // Avoid duplicates
  const exists = pendingChanges[type].some(c => c.fileName === data.fileName);
  if (!exists) {
    pendingChanges[type].push(data);
  }
}

// ➖ Remove pending change
function removePendingChange(type, fileName) {
  pendingChanges[type] = pendingChanges[type].filter(c => c.fileName !== fileName);
}

// 🧹 Clear all pending changes
function clearPendingChanges() {
  pendingChanges.new = [];
  pendingChanges.moved = [];
  pendingChanges.deleted = [];
  updateStatusBar();
}

// 📊 Update status bar
function updateStatusBar() {
  document.getElementById('newCount').textContent = pendingChanges.new.length;
  document.getElementById('movedCount').textContent = pendingChanges.moved.length;
  document.getElementById('deletedCount').textContent = pendingChanges.deleted.length;
  
  const totalChanges = pendingChanges.new.length + pendingChanges.moved.length + pendingChanges.deleted.length;
  document.getElementById('submitBtn').disabled = totalChanges === 0;
}

// 🔢 Update counts
function updateCounts() {
  const getCount = (id) => {
    const list = document.getElementById(id);
    const items = list.querySelectorAll('.file-item');
    return items.length;
  };
  
  document.getElementById('countRequired').textContent = getCount('requiredList');
  document.getElementById('countOptionalOn').textContent = getCount('optionalonList');
  document.getElementById('countOptionalOff').textContent = getCount('optionaloffList');
  document.getElementById('countShaders').textContent = getCount('shadersList');
  document.getElementById('countResourcepacks').textContent = getCount('resourcepacksList');
  document.getElementById('countFiles').textContent = getCount('filesList');
}

// ✅ Submit all changes (batch commit)
async function submitAllChanges() {
  const totalChanges = pendingChanges.new.length + pendingChanges.moved.length + pendingChanges.deleted.length;
  
  if (totalChanges === 0) {
    alert('No changes to submit');
    return;
  }
  
  if (!confirm(`✅ Submit ${totalChanges} changes?\n\n🆕 New: ${pendingChanges.new.length}\n🔄 Moved: ${pendingChanges.moved.length}\n🗑️ Deleted: ${pendingChanges.deleted.length}`)) {
    return;
  }
  
  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  
  try {
    let successCount = 0;
    let failedCount = 0;
    
    // Calculate total size
    const totalSize = pendingChanges.new.reduce((sum, f) => sum + (f.size || 0), 0);
    let uploadedSize = 0;
    
    // Upload new files individually (to handle large files)
    for (let i = 0; i < pendingChanges.new.length; i++) {
      const file = pendingChanges.new[i];
      const fileNum = i + 1;
      const totalFiles = pendingChanges.new.length;
      const percentage = Math.round((uploadedSize / totalSize) * 100);
      
      submitBtn.innerHTML = `
        <div class="loading"></div> 
        Uploading ${fileNum}/${totalFiles} (${percentage}%) 
        - ${file.fileName} (${formatFileSize(file.size)})
      `;
      
      const result = await window.api.uploadFile({
        serverId: currentServer,
        fileType: file.fileType,
        category: file.category,
        fileName: file.fileName,
        fileData: file.fileData
      });
      
      if (result.success) {
        successCount++;
        uploadedSize += file.size || 0;
      } else {
        console.error(`Failed to upload ${file.fileName}:`, result.error);
        failedCount++;
      }
    }
    
    // Delete files individually
    for (let i = 0; i < pendingChanges.deleted.length; i++) {
      const file = pendingChanges.deleted[i];
      const fileNum = i + 1;
      const totalFiles = pendingChanges.deleted.length;
      
      submitBtn.innerHTML = `<div class="loading"></div> Deleting ${fileNum}/${totalFiles} - ${file.fileName}`;
      
      if (file.filePath) {
        const result = await window.api.deleteFile({
          filePath: file.filePath,
          sha: file.sha
        });
        
        if (result.success) {
          successCount++;
        } else {
          console.error(`Failed to delete ${file.fileName}:`, result.error);
          failedCount++;
        }
      }
    }
    
    // Handle moved files (requires deleting and re-uploading)
    if (pendingChanges.moved.length > 0) {
      alert('⚠️ Move functionality requires manual handling. Please delete and re-upload files to move them.');
    }
    
    if (failedCount > 0) {
      alert(`⚠️ Completed with errors:\n✅ Success: ${successCount}\n❌ Failed: ${failedCount}\n\nTotal uploaded: ${formatFileSize(uploadedSize)}\n\nCheck console for details.`);
    } else {
      alert(`✅ Successfully submitted ${successCount} changes!\n\nTotal uploaded: ${formatFileSize(uploadedSize)}\n\nGitHub Actions will regenerate distribution.json in 2-3 minutes.`);
    }
    
    clearPendingChanges();
    await refreshAllFiles();
    
  } catch (error) {
    alert(`❌ Error: ${error.message}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '✅ Submit Changes';
  }
}

// 📏 Format file size
function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// 🚀 Initialize on load
init();
