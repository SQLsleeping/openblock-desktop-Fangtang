# openblock-desktop

[![Build and release](https://github.com/openblockcc/openblock-desktop/actions/workflows/build-and-release.yml/badge.svg)](https://github.com/openblockcc/openblock-desktop/actions/workflows/build-and-release.yml)
![GitHub release (latest by date)](https://img.shields.io/github/v/release/openblockcc/openblock-desktop)
![Total downloads](https://img.shields.io/github/downloads/openblockcc/openblock-desktop/total)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fopenblockcc%2Fopenblock-desktop.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2Fopenblockcc%2Fopenblock-desktop?ref=badge_shield)
[![Gitter](https://badges.gitter.im/openblockcc/community.svg)](https://gitter.im/openblockcc/community?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)
[![ko-fi](https://img.shields.io/badge/donate-sponsors-ea4aaa.svg?logo=ko-fi)](https://ko-fi.com/X8X66DATO)

OpenBlock as a standalone desktop application with **Remote Arduino** support via FangtangLink integration.

## 🚀 New Features

### Remote Arduino Programming
This version includes integrated **Remote Arduino** functionality that allows you to:
- 🌐 **Remote Flash**: Program Arduino devices over network via Raspberry Pi
- 🔄 **Seamless Integration**: Automatic switching between local and remote programming
- 📡 **Real-time Output**: Live streaming of programming process with formatted output
- 🎯 **Auto-detection**: Automatic Arduino CLI detection and platform installation
- 🍎 **Apple Silicon Support**: Full compatibility with Apple Silicon Macs using Rosetta 2

### How Remote Arduino Works
1. **Local Compilation**: Arduino code is compiled locally using arduino-cli
2. **Remote Programming**: Compiled hex files are uploaded to FangtangLink API server on Raspberry Pi
3. **Hardware Control**: Raspberry Pi controls Arduino reset and programming via GPIO and serial
4. **Real-time Feedback**: Live programming output with emoji-enhanced status messages

![screenshot](./doc/screenshot.png)
![screenshot2](./doc/screenshot2.png)

## Quick Start

### Standard Usage
Visit the wiki: [https://wiki.openblock.cc](https://wiki.openblock.cc)

### Remote Arduino Setup
For remote Arduino programming via FangtangLink:

1. **Setup FangtangLink Server** (on Raspberry Pi):
   ```bash
   # See doc/FangtangLink/README.md for detailed setup
   python run_server.py --host 0.0.0.0 --port 5000
   ```

2. **Configure OpenBlock Desktop**:
   - Go to Menu → About → Remote Flasher Settings
   - Enter your Raspberry Pi IP: `http://192.168.x.x:5000`
   - Test connection and save

3. **Start Programming**:
   - Create Arduino projects normally
   - Select "Remote Arduino" device
   - Upload code - it will be compiled locally and flashed remotely!

📖 **Detailed Documentation**: See [REMOTE_FLASHER_README.md](./REMOTE_FLASHER_README.md)

## Join chat

- Gitter: [https://gitter.im/openblockcc/community](https://gitter.im/openblockcc/community?utm_source=share-link&utm_medium=link&utm_campaign=share-link)

- QQ 群 (for chinese): 933484739

## Donate

Buy me a cup of coffee.

- Ko-fi (PayPal):

    [![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/X8X66DATO)

- 支付宝:

    ![alipayQRCode](./doc/alipayQRCode.png)

## Features

### Core Features
- 🎨 **Visual Programming**: Drag-and-drop block-based programming
- 🔧 **Arduino Support**: Full Arduino IDE compatibility with auto-detection
- 📱 **Multiple Platforms**: Windows, macOS, Linux support
- 🌍 **Multi-language**: Support for multiple languages
- 🔌 **Extension System**: Rich ecosystem of extensions and libraries

### Remote Arduino Features
- 🌐 **Network Programming**: Program Arduino over network via Raspberry Pi
- 🔄 **Hybrid Workflow**: Local compilation + remote programming
- 📡 **Live Output**: Real-time programming status with formatted messages
- 🎯 **Smart Detection**: Auto-detect arduino-cli and install required platforms
- 🍎 **Apple Silicon**: Native support for Apple Silicon Macs
- 🔧 **Easy Setup**: Simple configuration through GUI interface

## Architecture

### Remote Arduino Integration
```
OpenBlock Desktop (Client)
    ↓ Local Compilation (arduino-cli)
    ↓ HTTP API Upload
Raspberry Pi (FangtangLink Server)
    ↓ GPIO Control + Serial Communication
Arduino Device
```

### Key Components
- **RemoteFlasherClient.js**: API communication with FangtangLink server
- **RemoteArduinoUploader.js**: Extended Arduino uploader with remote support
- **Arduino CLI Integration**: Automatic detection and platform management
- **Real-time Output**: Streaming programming output with emoji formatting

## Bug Report

You can submit the bug log in issues of this project.

### Remote Arduino Issues
For Remote Arduino specific issues, please include:
- FangtangLink server version and status
- Network configuration (IP addresses, ports)
- Arduino CLI version and platform info
- Complete error logs from both client and server


## License
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fopenblockcc%2Fopenblock-desktop.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fopenblockcc%2Fopenblock-desktop?ref=badge_large)
