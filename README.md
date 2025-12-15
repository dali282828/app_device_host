# AIForge Device Host - Electron App

## Overview

AIForge Device Host is an Electron desktop application that allows device owners to securely rent out their hardware (servers, GPUs, storage, etc.) through the AIForge network.

## Features

- **Device Registration**: Register your device on the blockchain
- **Secure Isolation**: Container-based isolation for tenant access
- **Booking Management**: Manage device bookings and payments
- **Resource Monitoring**: Monitor device usage and earnings
- **Secure Credential Management**: Encrypted storage of credentials

## Security Architecture

### Container Isolation
- Each tenant gets an isolated Docker container
- No access to host filesystem or node credentials
- Network isolation between tenants
- Resource limits enforced

### Credential Protection
- Node credentials encrypted at rest
- Token rotation every 24 hours
- IP whitelisting for backend access
- Audit logging for all operations

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Requirements

- Docker (for container isolation)
- Node.js 18+
- Python 3.8+ (for device management scripts)

## Architecture

```
app_device_host/
├── main.js              # Main Electron process
├── preload.js           # Preload script (security)
├── index.html           # UI
├── renderer.js          # Renderer process
├── device-manager/      # Device management Python scripts
│   ├── device_registry.py
│   ├── container_manager.py
│   └── credential_manager.py
└── assets/              # Icons and resources
```

## Integration

- Backend API: `https://aiforge-backend.fly.dev/api`
- Smart Contract: `DeviceRegistry.sol` (to be deployed)
- Blockchain: Polygon

## Security Notes

⚠️ **IMPORTANT**: This app manages sensitive credentials. Never share:
- Node authentication tokens
- Wallet private keys
- Backend API credentials

Always use encrypted storage and secure communication channels.

