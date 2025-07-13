# Remote Flasher Tests

这个文件夹包含了OpenBlock Desktop远程烧录功能的测试脚本。

## 测试脚本说明

### 1. `demo-remote-flasher.js`
演示远程烧录功能的基本使用，包括：
- 连接测试
- 设备信息获取
- 文件烧录演示
- 流式烧录演示

**使用方法：**
```bash
node tests/remote-flasher/demo-remote-flasher.js
```

### 2. `test-device-connection.js`
测试设备连接和远程烧录功能，包括：
- 远程设备发现测试
- 设备信息获取测试
- 远程烧录测试
- 完整工作流程测试

**使用方法：**
```bash
node tests/remote-flasher/test-device-connection.js
```

### 3. `test-remote-device-ui.js`
测试远程设备在UI中的显示和连接功能：
- 启动OpenBlock Desktop
- 检查远程服务器状态
- 提供UI测试指导

**使用方法：**
```bash
node tests/remote-flasher/test-remote-device-ui.js
```

## 测试前准备

1. **启动FangtangLink服务器**
   ```bash
   cd doc/FangtangLink
   python -m src.remote_flasher.api_server
   ```

2. **确保网络连接**
   - 检查服务器IP地址是否正确
   - 确保防火墙允许5000端口访问

3. **配置OpenBlock Desktop**
   - 启动应用程序
   - 配置远程烧录服务器地址
   - 测试连接

## 故障排除

### 远程设备不显示在设备列表中
1. 检查远程烧录配置是否已启用
2. 检查服务器连接是否正常
3. 重启OpenBlock Desktop应用程序
4. 查看开发者工具控制台日志

### 网络连接问题
- 系统会自动使用curl备用方案
- 检查curl是否可用：`curl --version`
- 查看详细的网络请求日志

### 烧录失败
1. 检查Arduino是否正确连接到Raspberry Pi
2. 检查串口权限和配置
3. 查看avrdude输出日志

## 调试技巧

1. **开启详细日志**
   - 在RemoteFlasherClient中设置debug模式
   - 查看控制台输出

2. **使用开发者工具**
   - 按F12或Ctrl+Shift+I打开开发者工具
   - 查看Console和Network标签

3. **检查服务器日志**
   - 查看FangtangLink服务器的输出日志
   - 检查API请求和响应

## 测试环境

- **OpenBlock Desktop**: v2.6.3
- **Node.js**: v16+
- **FangtangLink**: v1.0.0
- **操作系统**: macOS/Windows/Linux
