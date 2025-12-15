const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const Docker = require('dockerode');
const crypto = require('crypto');

let mainWindow;
let docker = null;
let deviceStatus = {
  registered: false,
  deviceId: null,
  deviceType: null,
  isActive: false,
  hourlyRate: 0,
  totalBookings: 0,
  totalEarnings: 0,
  currentBookings: []
};

// Check if running in development
const isDev = process.argv.includes('--dev');

// Initialize Docker connection
function initDocker() {
  try {
    docker = new Docker();
    return docker.ping().then(() => true).catch(() => false);
  } catch (error) {
    console.error('Docker initialization failed:', error);
    return false;
  }
}

// Master key for credential encryption (should be stored securely)
let masterKey = null;

function loadOrCreateMasterKey() {
  const keyPath = path.join(app.getPath('userData'), 'master.key');
  try {
    if (fs.existsSync(keyPath)) {
      masterKey = fs.readFileSync(keyPath, 'utf8');
    } else {
      // Generate new master key
      masterKey = crypto.randomBytes(32).toString('hex');
      fs.writeFileSync(keyPath, masterKey, { mode: 0o600 }); // Read-only for owner
    }
  } catch (error) {
    console.error('Failed to load master key:', error);
    masterKey = crypto.randomBytes(32).toString('hex');
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: fs.existsSync(path.join(__dirname, 'assets', 'icon.png')) 
      ? path.join(__dirname, 'assets', 'icon.png')
      : undefined,
    titleBarStyle: 'default',
    show: false
  });

  mainWindow.loadFile('index.html');

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App event handlers
app.whenReady().then(() => {
  loadOrCreateMasterKey();
  initDocker().then(dockerAvailable => {
    if (!dockerAvailable) {
      console.warn('Docker not available - container isolation disabled');
    }
  });
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('get-device-status', () => {
  return deviceStatus;
});

ipcMain.handle('check-docker', async () => {
  if (!docker) {
    const available = await initDocker();
    return { available, error: available ? null : 'Docker not available' };
  }
  try {
    await docker.ping();
    return { available: true, error: null };
  } catch (error) {
    return { available: false, error: error.message };
  }
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('open-external', async (event, url) => {
  // Validate URL to prevent protocol-based attacks
  try {
    const parsedUrl = new URL(url);
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      console.error('Invalid URL protocol:', parsedUrl.protocol);
      return { success: false, error: 'Invalid URL protocol. Only http and https are allowed.' };
    }
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Invalid URL:', error);
    return { success: false, error: 'Invalid URL format' };
  }
});

ipcMain.handle('analyze-system', async () => {
  const os = require('os');
  return {
    platform: process.platform,
    arch: process.arch,
    cpuCount: os.cpus().length,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    hostname: os.hostname()
  };
});

// Device Management
ipcMain.handle('register-device', async (event, deviceInfo) => {
  try {
    // TODO: Register device with backend API
    // TODO: Register device on blockchain (DeviceRegistry contract)
    
    deviceStatus = {
      ...deviceStatus,
      registered: true,
      deviceId: deviceInfo.deviceId || `device-${Date.now()}`,
      deviceType: deviceInfo.deviceType,
      hourlyRate: deviceInfo.hourlyRate || 0,
      isActive: true
    };
    
    // Save device status
    const statusPath = path.join(app.getPath('userData'), 'device-status.json');
    fs.writeFileSync(statusPath, JSON.stringify(deviceStatus, null, 2));
    
    // Emit status update
    mainWindow.webContents.send('device-status-update', deviceStatus);
    
    return { success: true, deviceId: deviceStatus.deviceId };
  } catch (error) {
    console.error('Device registration failed:', error);
    return { success: false, error: error.message };
  }
});

// Container Management
ipcMain.handle('create-tenant-container', async (event, bookingId, tenantConfig) => {
  if (!docker) {
    return { success: false, error: 'Docker not available' };
  }
  
  try {
    // Create isolated container for tenant
    const container = await docker.createContainer({
      Image: tenantConfig.image || 'ubuntu:22.04',
      Cmd: ['/bin/bash'],
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
      OpenStdin: true,
      NetworkDisabled: false,
      // Resource limits
      HostConfig: {
        Memory: tenantConfig.memoryLimit || 1024 * 1024 * 1024, // 1GB default
        CpuShares: tenantConfig.cpuShares || 1024,
        NetworkMode: 'bridge',
        // Isolated filesystem
        Binds: [
          `${path.join(app.getPath('userData'), 'containers', bookingId)}:/workspace:rw`
        ]
      },
      // Environment variables (no sensitive data)
      Env: [
        `BOOKING_ID=${bookingId}`,
        `TENANT_ID=${tenantConfig.tenantId}`
      ]
    });
    
    await container.start();
    
    return {
      success: true,
      containerId: container.id,
      bookingId: bookingId
    };
  } catch (error) {
    console.error('Container creation failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-tenant-container', async (event, containerId) => {
  if (!docker) {
    return { success: false, error: 'Docker not available' };
  }
  
  try {
    const container = docker.getContainer(containerId);
    await container.stop();
    await container.remove();
    
    return { success: true };
  } catch (error) {
    console.error('Container stop failed:', error);
    return { success: false, error: error.message };
  }
});

// Credential Encryption
ipcMain.handle('encrypt-credentials', (event, credentials) => {
  if (!masterKey) {
    loadOrCreateMasterKey();
  }
  
  try {
    // Generate a random IV for each encryption (16 bytes for AES-256-CBC)
    const iv = crypto.randomBytes(16);
    
    // Ensure masterKey is a Buffer of correct length (32 bytes for AES-256)
    const keyBuffer = Buffer.from(masterKey, 'hex');
    if (keyBuffer.length !== 32) {
      // If masterKey is not 32 bytes, derive a key using PBKDF2
      const derivedKey = crypto.pbkdf2Sync(masterKey, 'aiforge-salt', 100000, 32, 'sha256');
      const cipher = crypto.createCipheriv('aes-256-cbc', derivedKey, iv);
      let encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      // Prepend IV to encrypted data (IV doesn't need to be secret, just unique)
      return { success: true, encrypted: iv.toString('hex') + ':' + encrypted };
    } else {
      const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
      let encrypted = cipher.update(JSON.stringify(credentials), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      // Prepend IV to encrypted data
      return { success: true, encrypted: iv.toString('hex') + ':' + encrypted };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('decrypt-credentials', (event, encryptedData) => {
  if (!masterKey) {
    loadOrCreateMasterKey();
  }
  
  try {
    // Extract IV and encrypted data (format: iv:encrypted)
    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
      return { success: false, error: 'Invalid encrypted data format. Please re-encrypt your credentials.' };
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    // Validate IV length
    if (iv.length !== 16) {
      return { success: false, error: 'Invalid IV length' };
    }
    
    // Ensure masterKey is a Buffer of correct length
    const keyBuffer = Buffer.from(masterKey, 'hex');
    if (keyBuffer.length !== 32) {
      // Derive key using PBKDF2 if masterKey is not exactly 32 bytes
      const derivedKey = crypto.pbkdf2Sync(masterKey, 'aiforge-salt', 100000, 32, 'sha256');
      const decipher = crypto.createDecipheriv('aes-256-cbc', derivedKey, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return { success: true, credentials: JSON.parse(decrypted) };
    } else {
      const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return { success: true, credentials: JSON.parse(decrypted) };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Load saved device status on startup
function loadDeviceStatus() {
  try {
    const statusPath = path.join(app.getPath('userData'), 'device-status.json');
    if (fs.existsSync(statusPath)) {
      const saved = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
      deviceStatus = { ...deviceStatus, ...saved };
    }
  } catch (error) {
    console.error('Failed to load device status:', error);
  }
}

// Load on startup
app.whenReady().then(() => {
  loadDeviceStatus();
});

