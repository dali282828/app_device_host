const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Device management
  getDeviceStatus: () => ipcRenderer.invoke('get-device-status'),
  registerDevice: (deviceInfo) => ipcRenderer.invoke('register-device', deviceInfo),
  updateDeviceStatus: (status) => ipcRenderer.invoke('update-device-status', status),
  
  // Booking management
  getBookings: () => ipcRenderer.invoke('get-bookings'),
  getBookingDetails: (bookingId) => ipcRenderer.invoke('get-booking-details', bookingId),
  completeBooking: (bookingId) => ipcRenderer.invoke('complete-booking', bookingId),
  
  // Container management
  createTenantContainer: (bookingId, tenantConfig) => ipcRenderer.invoke('create-tenant-container', bookingId, tenantConfig),
  stopTenantContainer: (containerId) => ipcRenderer.invoke('stop-tenant-container', containerId),
  getContainerStatus: (containerId) => ipcRenderer.invoke('get-container-status', containerId),
  
  // Resource monitoring
  getDeviceResources: () => ipcRenderer.invoke('get-device-resources'),
  getResourceUsage: () => ipcRenderer.invoke('get-resource-usage'),
  
  // Earnings
  getEarnings: () => ipcRenderer.invoke('get-earnings'),
  getEarningsHistory: () => ipcRenderer.invoke('get-earnings-history'),
  
  // Wallet connection
  connectWallet: () => ipcRenderer.invoke('connect-wallet'),
  getWalletAddress: () => ipcRenderer.invoke('get-wallet-address'),
  
  // Blockchain operations
  registerDeviceOnChain: (deviceInfo) => ipcRenderer.invoke('register-device-on-chain', deviceInfo),
  updateDeviceOnChain: (deviceId, updates) => ipcRenderer.invoke('update-device-on-chain', deviceId, updates),
  
  // Security
  encryptCredentials: (credentials) => ipcRenderer.invoke('encrypt-credentials', credentials),
  decryptCredentials: (encryptedData) => ipcRenderer.invoke('decrypt-credentials', encryptedData),
  rotateToken: () => ipcRenderer.invoke('rotate-token'),
  
  // System info
  analyzeSystem: () => ipcRenderer.invoke('analyze-system'),
  checkDocker: () => ipcRenderer.invoke('check-docker'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // External links
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // Event listeners
  onDeviceStatusUpdate: (callback) => {
    ipcRenderer.on('device-status-update', (event, status) => callback(status));
  },
  onBookingUpdate: (callback) => {
    ipcRenderer.on('booking-update', (event, booking) => callback(booking));
  },
  onContainerUpdate: (callback) => {
    ipcRenderer.on('container-update', (event, container) => callback(container));
  },
  onEarningsUpdate: (callback) => {
    ipcRenderer.on('earnings-update', (event, earnings) => callback(earnings));
  },
  
  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

