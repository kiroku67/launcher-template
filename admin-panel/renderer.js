let authenticated = false;

async function authenticate() {
  const token = document.getElementById('token-input').value;
  const statusEl = document.getElementById('auth-status');
  
  if (!token) {
    statusEl.textContent = '❌ Please enter a token';
    statusEl.className = 'error';
    return;
  }
  
  statusEl.textContent = '⏳ Authenticating...';
  statusEl.className = '';
  
  const result = await window.api.authenticate(token);
  
  if (result.success) {
    statusEl.textContent = `✅ Authenticated as ${result.username}`;
    statusEl.className = 'success';
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('admin-section').classList.remove('hidden');
    authenticated = true;
    refreshMods();
  } else {
    statusEl.textContent = `❌ Authentication failed: ${result.error}`;
    statusEl.className = 'error';
  }
}

async function uploadMod() {
  if (!authenticated) {
    alert('Please authenticate first');
    return;
  }
  
  const fileInput = document.getElementById('mod-file');
  const modType = document.getElementById('mod-type').value;
  
  if (!fileInput.files[0]) {
    alert('Please select a mod file (.jar)');
    return;
  }
  
  const file = fileInput.files[0];
  const fileName = file.name;
  
  if (!fileName.endsWith('.jar')) {
    alert('Only .jar files are allowed');
    return;
  }
  
  // Read file as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);
  
  const result = await window.api.uploadMod({
    fileName: fileName,
    fileData: Array.from(buffer), // Convert to regular array for IPC
    modType: modType
  });
  
  if (result.success) {
    alert(`✅ Mod "${fileName}" uploaded successfully!\n\nChanges will appear in 2-3 minutes after GitHub Actions completes.`);
    fileInput.value = '';
    setTimeout(refreshMods, 2000);
  } else {
    alert(`❌ Upload failed: ${result.error}`);
  }
}

async function deleteMod(modPath, modName) {
  if (!authenticated) return;
  
  if (!confirm(`Are you sure you want to delete "${modName}"?`)) {
    return;
  }
  
  const result = await window.api.deleteMod(modPath);
  
  if (result.success) {
    alert(`✅ Mod "${modName}" deleted!\n\nChanges will appear in 2-3 minutes after GitHub Actions completes.`);
    setTimeout(refreshMods, 2000);
  } else {
    alert(`❌ Delete failed: ${result.error}`);
  }
}

async function refreshMods() {
  if (!authenticated) return;
  
  const container = document.getElementById('mod-list');
  container.innerHTML = '<p style="text-align: center; color: #888;">⏳ Loading mods...</p>';
  
  const result = await window.api.listMods();
  
  if (result.success) {
    container.innerHTML = '';
    
    const typeLabels = {
      'required': '⚙️ Required Mods',
      'optionalon': '✅ Optional Mods (Enabled)',
      'optionaloff': '❌ Optional Mods (Disabled)'
    };
    
    let totalMods = 0;
    
    for (const [type, mods] of Object.entries(result.mods)) {
      const section = document.createElement('div');
      section.className = 'mod-section';
      
      const header = document.createElement('h3');
      header.textContent = typeLabels[type] || type.toUpperCase();
      section.appendChild(header);
      
      if (mods.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.textContent = 'No mods in this category';
        emptyMsg.style.color = '#666';
        emptyMsg.style.fontStyle = 'italic';
        section.appendChild(emptyMsg);
      } else {
        mods.forEach(mod => {
          const item = document.createElement('div');
          item.className = 'mod-item';
          
          const info = document.createElement('div');
          info.className = 'mod-info';
          
          const name = document.createElement('div');
          name.className = 'mod-name';
          name.textContent = mod.name;
          
          const size = document.createElement('div');
          size.className = 'mod-size';
          size.textContent = `Size: ${(mod.size / 1024 / 1024).toFixed(2)} MB`;
          
          info.appendChild(name);
          info.appendChild(size);
          
          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'delete-btn';
          deleteBtn.textContent = '🗑️ Delete';
          deleteBtn.onclick = () => deleteMod(mod.path, mod.name);
          
          item.appendChild(info);
          item.appendChild(deleteBtn);
          section.appendChild(item);
          
          totalMods++;
        });
      }
      
      container.appendChild(section);
    }
    
    if (totalMods === 0) {
      const noMods = document.createElement('p');
      noMods.textContent = 'No mods uploaded yet. Upload your first mod above!';
      noMods.style.textAlign = 'center';
      noMods.style.color = '#888';
      noMods.style.marginTop = '20px';
      container.appendChild(noMods);
    }
  } else {
    container.innerHTML = `<p style="color: #ff6666;">Error loading mods: ${result.error}</p>`;
  }
}

// Allow Enter key to authenticate
document.addEventListener('DOMContentLoaded', () => {
  const tokenInput = document.getElementById('token-input');
  if (tokenInput) {
    tokenInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        authenticate();
      }
    });
  }
});
