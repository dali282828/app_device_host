// Device Host Renderer Process
// Handles UI interactions and communicates with main process

// Get DOM elements
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const registrationPanel = document.getElementById('registration-panel');
const dashboardPanel = document.getElementById('dashboard-panel');
const bookingsPanel = document.getElementById('bookings-panel');
const earningsPanel = document.getElementById('earnings-panel');
const securityPanel = document.getElementById('security-panel');

// Device status
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

// Load app version
window.electronAPI.getAppVersion().then(version => {
  document.getElementById('app-version').textContent = `v${version}`;
});

// Initialize
async function init() {
  // Check Docker availability
  const dockerStatus = await window.electronAPI.checkDocker();
  updateDockerStatus(dockerStatus);
  
  // Load device status
  await loadDeviceStatus();
  
  // Set up event listeners
  setupEventListeners();
  
  // Check system info
  const systemInfo = await window.electronAPI.analyzeSystem();
  updateSystemInfo(systemInfo);
}

// Setup event listeners
function setupEventListeners() {
  // Device registration form
  const registrationForm = document.getElementById('device-registration-form');
  registrationForm.addEventListener('submit', handleDeviceRegistration);
  
  // Wallet connection
  const connectWalletBtn = document.getElementById('connect-wallet-btn');
  connectWalletBtn.addEventListener('click', handleConnectWallet);
  
  // Navigation
  document.getElementById('dashboard-link').addEventListener('click', () => showPanel('dashboard'));
  document.getElementById('bookings-link').addEventListener('click', () => showPanel('bookings'));
  document.getElementById('earnings-link').addEventListener('click', () => showPanel('earnings'));
  document.getElementById('security-link').addEventListener('click', () => showPanel('security'));
  
  // Device management
  document.getElementById('update-device-btn')?.addEventListener('click', handleUpdateDevice);
  document.getElementById('deactivate-device-btn')?.addEventListener('click', handleDeactivateDevice);
  document.getElementById('rotate-token-btn')?.addEventListener('click', handleRotateToken);
  
  // Listen for status updates
  window.electronAPI.onDeviceStatusUpdate((status) => {
    deviceStatus = status;
    updateUI();
  });
  
  window.electronAPI.onBookingUpdate((booking) => {
    updateBookingsList();
  });
  
  window.electronAPI.onEarningsUpdate((earnings) => {
    updateEarnings();
  });
}

// Load device status
async function loadDeviceStatus() {
  try {
    const status = await window.electronAPI.getDeviceStatus();
    deviceStatus = status;
    updateUI();
  } catch (error) {
    console.error('Failed to load device status:', error);
  }
}

// Update UI based on device status
function updateUI() {
  if (deviceStatus.registered) {
    // Show dashboard, hide registration
    registrationPanel.style.display = 'none';
    dashboardPanel.style.display = 'block';
    bookingsPanel.style.display = 'block';
    earningsPanel.style.display = 'block';
    securityPanel.style.display = 'block';
    
    // Update status indicator
    statusDot.classList.add('active');
    statusText.textContent = 'Registered & Active';
    
    // Update dashboard
    document.getElementById('device-id-display').textContent = deviceStatus.deviceId || '-';
    document.getElementById('device-type-display').textContent = deviceStatus.deviceType || '-';
    document.getElementById('device-status-display').textContent = deviceStatus.isActive ? 'Active' : 'Inactive';
    document.getElementById('device-rate-display').textContent = deviceStatus.hourlyRate || '0';
    document.getElementById('total-bookings').textContent = deviceStatus.totalBookings || '0';
    document.getElementById('active-bookings').textContent = deviceStatus.currentBookings?.length || '0';
    document.getElementById('total-earnings').textContent = deviceStatus.totalEarnings || '0';
    document.getElementById('total-earnings-display').textContent = `${deviceStatus.totalEarnings || '0'} USDT`;
  } else {
    // Show registration, hide dashboard
    registrationPanel.style.display = 'block';
    dashboardPanel.style.display = 'none';
    bookingsPanel.style.display = 'none';
    earningsPanel.style.display = 'none';
    securityPanel.style.display = 'none';
    
    statusDot.classList.remove('active');
    statusText.textContent = 'Not Registered';
  }
}

// Handle device registration
async function handleDeviceRegistration(event) {
  event.preventDefault();
  
  const formData = {
    name: document.getElementById('device-name').value,
    deviceType: document.getElementById('device-type').value,
    hourlyRate: parseFloat(document.getElementById('hourly-rate').value),
    walletAddress: document.getElementById('wallet-address').value,
    description: document.getElementById('device-description').value
  };
  
  try {
    const result = await window.electronAPI.registerDevice(formData);
    if (result.success) {
      alert(`Device registered successfully! ID: ${result.deviceId}`);
      await loadDeviceStatus();
    } else {
      alert(`Registration failed: ${result.error}`);
    }
  } catch (error) {
    console.error('Registration error:', error);
    alert('Failed to register device');
  }
}

// Handle wallet connection
async function handleConnectWallet() {
  try {
    const result = await window.electronAPI.connectWallet();
    if (result.success) {
      document.getElementById('wallet-address').value = result.address;
      alert('Wallet connected successfully!');
    } else {
      alert('Wallet connection failed. Please enter address manually.');
    }
  } catch (error) {
    console.error('Wallet connection error:', error);
  }
}

// Update Docker status
function updateDockerStatus(status) {
  const dockerStatusEl = document.getElementById('docker-status');
  const dockerBadge = document.getElementById('docker-status-badge');
  
  if (status.available) {
    dockerStatusEl.textContent = 'Docker is available - Container isolation enabled';
    dockerBadge.textContent = 'Active';
    dockerBadge.classList.add('status-active');
    dockerBadge.classList.remove('status-inactive');
  } else {
    dockerStatusEl.textContent = `Docker not available: ${status.error || 'Unknown error'}`;
    dockerBadge.textContent = 'Inactive';
    dockerBadge.classList.add('status-inactive');
    dockerBadge.classList.remove('status-active');
  }
}

// Update system info
function updateSystemInfo(info) {
  document.getElementById('cpu-info').textContent = `${info.cpuCount} cores`;
  document.getElementById('memory-info').textContent = `${(info.totalMemory / 1024 / 1024 / 1024).toFixed(2)} GB`;
  document.getElementById('storage-info').textContent = 'Checking...';
}

// Show panel
function showPanel(panelName) {
  // Hide all panels
  [dashboardPanel, bookingsPanel, earningsPanel, securityPanel].forEach(panel => {
    panel.style.display = 'none';
  });
  
  // Show selected panel
  switch(panelName) {
    case 'dashboard':
      dashboardPanel.style.display = 'block';
      break;
    case 'bookings':
      bookingsPanel.style.display = 'block';
      updateBookingsList();
      break;
    case 'earnings':
      earningsPanel.style.display = 'block';
      updateEarnings();
      break;
    case 'security':
      securityPanel.style.display = 'block';
      break;
  }
}

// Update bookings list
async function updateBookingsList() {
  try {
    const bookings = await window.electronAPI.getBookings();
    const bookingsList = document.getElementById('bookings-list');
    
    if (bookings.length === 0) {
      bookingsList.innerHTML = '<p class="empty-state">No active bookings</p>';
      return;
    }
    
    bookingsList.innerHTML = bookings.map(booking => `
      <div class="booking-item">
        <h4>Booking #${booking.id}</h4>
        <p><strong>Tenant:</strong> ${booking.tenantAddress || 'Unknown'}</p>
        <p><strong>Start:</strong> ${new Date(booking.startTime).toLocaleString()}</p>
        <p><strong>End:</strong> ${new Date(booking.endTime).toLocaleString()}</p>
        <p><strong>Status:</strong> ${booking.status}</p>
        <p><strong>Amount:</strong> ${booking.totalCost} USDT</p>
        ${booking.status === 'ACTIVE' ? `
          <button class="btn-secondary" onclick="completeBooking(${booking.id})">Complete Booking</button>
        ` : ''}
      </div>
    `).join('');
  } catch (error) {
    console.error('Failed to load bookings:', error);
  }
}

// Update earnings
async function updateEarnings() {
  try {
    const earnings = await window.electronAPI.getEarnings();
    const history = await window.electronAPI.getEarningsHistory();
    
    document.getElementById('total-earnings-display').textContent = `${earnings.total || '0'} USDT`;
    document.getElementById('monthly-earnings').textContent = `${earnings.monthly || '0'} USDT`;
    
    // Update earnings table
    const tableBody = document.getElementById('earnings-table-body');
    if (history.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="4" class="empty-state">No earnings yet</td></tr>';
    } else {
      tableBody.innerHTML = history.map(entry => `
        <tr>
          <td>${new Date(entry.date).toLocaleDateString()}</td>
          <td>#${entry.bookingId}</td>
          <td>${entry.hours}</td>
          <td>${entry.amount} USDT</td>
        </tr>
      `).join('');
    }
  } catch (error) {
    console.error('Failed to load earnings:', error);
  }
}

// Handle update device
async function handleUpdateDevice() {
  // TODO: Implement device update
  alert('Device update feature coming soon');
}

// Handle deactivate device
async function handleDeactivateDevice() {
  if (confirm('Are you sure you want to deactivate this device?')) {
    try {
      await window.electronAPI.updateDeviceStatus({ isActive: false });
      alert('Device deactivated');
      await loadDeviceStatus();
    } catch (error) {
      console.error('Failed to deactivate device:', error);
      alert('Failed to deactivate device');
    }
  }
}

// Handle rotate token
async function handleRotateToken() {
  if (confirm('Rotate authentication token? This will require re-authentication.')) {
    try {
      const result = await window.electronAPI.rotateToken();
      if (result.success) {
        alert('Token rotated successfully');
      } else {
        alert(`Token rotation failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Token rotation error:', error);
      alert('Failed to rotate token');
    }
  }
}

// Complete booking
async function completeBooking(bookingId) {
  if (confirm('Complete this booking and release payment?')) {
    try {
      const result = await window.electronAPI.completeBooking(bookingId);
      if (result.success) {
        alert('Booking completed successfully');
        await updateBookingsList();
        await updateEarnings();
      } else {
        alert(`Failed to complete booking: ${result.error}`);
      }
    } catch (error) {
      console.error('Complete booking error:', error);
      alert('Failed to complete booking');
    }
  }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);

