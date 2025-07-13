# OpenBlock Desktop 远程烧录功能

本文档介绍如何在OpenBlock Desktop中使用FangtangLink远程烧录功能，实现通过网络连接到Raspberry Pi上的烧录服务器进行远程Arduino烧录。

## 功能概述

- 🌐 **远程烧录**: 通过IP地址连接到Raspberry Pi上的FangtangLink API服务器
- 🔄 **无缝切换**: 在本地烧录和远程烧录之间自动切换
- ⚙️ **图形化配置**: 通过GUI界面配置远程烧录服务器
- 🔧 **兼容性**: 与现有的Arduino项目完全兼容
- 📡 **实时输出**: 支持实时查看远程烧录过程

## 系统要求

### Raspberry Pi端 (FangtangLink服务器)
- Raspberry Pi (推荐Pi 4或更新版本)
- Raspberry Pi OS
- Python 3.7+
- FangtangLink API服务器
- 连接到Arduino的硬件接口

### OpenBlock Desktop端
- OpenBlock Desktop (本修改版本)
- 网络连接到Raspberry Pi

## 安装和配置

### 1. 设置FangtangLink服务器

在Raspberry Pi上设置FangtangLink服务器：

```bash
# 克隆FangtangLink项目
git clone <fangtanglink-repo-url>
cd FangtangLink

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 安装系统依赖
sudo apt-get update
sudo apt-get install avrdude wiringpi

# 启动服务器
python run_server.py --host 0.0.0.0 --port 5000
```

### 2. 硬件连接

连接Raspberry Pi和Arduino：

```
Raspberry Pi    Arduino/AVR Target
GPIO 4     -->  RST (复位引脚)
/dev/ttyS0 -->  通过串口连接
GND        -->  GND
5V/3.3V    -->  VCC
```

### 3. 配置OpenBlock Desktop

1. 启动OpenBlock Desktop
2. 点击菜单栏的"关于" -> "Remote Flasher Settings"
3. 点击"Configure"
4. 输入Raspberry Pi的IP地址，例如：`http://192.168.1.100:5000`
5. 点击"Test Connection"验证连接
6. 如果连接成功，远程烧录功能将被启用

## 使用方法

### 基本使用

1. **创建或打开Arduino项目**: 在OpenBlock Desktop中正常创建或打开Arduino项目
2. **编写代码**: 使用图形化编程界面编写Arduino代码
3. **连接设备**: 选择连接到远程设备（通过配置的Raspberry Pi）
4. **上传代码**: 点击上传按钮，代码将通过远程烧录服务器烧录到Arduino

### 配置管理

#### 启用远程烧录
```
菜单栏 -> 关于 -> Remote Flasher Settings -> Configure
输入服务器地址 -> 测试连接 -> 保存
```

#### 禁用远程烧录
```
菜单栏 -> 关于 -> Remote Flasher Settings -> Disable
```

#### 测试连接
```
菜单栏 -> 关于 -> Remote Flasher Settings -> Test Connection
```

### 命令行测试

使用提供的测试脚本验证功能：

```bash
# 运行测试脚本
node test-remote-flasher.js

# 或者使用npm（如果配置了package.json）
npm run test:remote-flasher
```

## 工作原理

### 架构概述

```
OpenBlock Desktop (客户端)
    ↓ HTTP API调用
Raspberry Pi (FangtangLink服务器)
    ↓ GPIO控制 + 串口通信
Arduino设备
```

### 烧录流程

1. **代码编译**: OpenBlock Desktop在本地编译Arduino代码生成hex文件
2. **文件传输**: 将hex文件通过HTTP API上传到FangtangLink服务器
3. **设备控制**: 服务器通过GPIO控制Arduino复位进入bootloader模式
4. **程序烧录**: 服务器使用avrdude通过串口烧录程序到Arduino
5. **设备重启**: 烧录完成后重启Arduino运行新程序
6. **状态反馈**: 实时返回烧录过程和结果到OpenBlock Desktop

### 关键组件

- **RemoteFlasherClient.js**: 与FangtangLink API通信的客户端
- **RemoteArduinoUploader.js**: 远程Arduino上传器，扩展本地上传功能
- **OpenblockDesktopLink.js**: 集成远程烧录到主应用
- **serialport.js**: 修改后的串口会话，支持远程烧录

## API接口

### 主要API端点

- `GET /status` - 获取服务器状态
- `GET /config` - 获取服务器配置
- `POST /flash/file` - 上传并烧录hex文件
- `POST /flash/stream` - 流式烧录（实时输出）
- `POST /control/reset` - 控制设备复位
- `GET /device/info` - 获取设备信息

### 配置文件

远程烧录配置存储在：
```
~/.config/OpenBlock Desktop/Data/remote-flasher-config.json
```

配置格式：
```json
{
  "enabled": true,
  "serverUrl": "http://192.168.1.100:5000",
  "lastUpdated": "2025-01-13T10:30:00.000Z"
}
```

## 故障排除

### 常见问题

1. **连接失败**
   - 检查Raspberry Pi IP地址是否正确
   - 确认FangtangLink服务器正在运行
   - 检查网络连接和防火墙设置

2. **烧录失败**
   - 确认Arduino设备正确连接到Raspberry Pi
   - 检查串口权限和设备路径
   - 验证avrdude配置

3. **权限错误**
   ```bash
   # 在Raspberry Pi上设置权限
   sudo usermod -a -G dialout $USER
   sudo usermod -a -G gpio $USER
   ```

### 调试模式

启用调试输出：
```bash
# 在Raspberry Pi上以调试模式启动服务器
python run_server.py --debug

# 查看OpenBlock Desktop控制台输出
# 在开发者工具中查看网络请求和错误信息
```

### 日志文件

- **FangtangLink服务器日志**: `flasher.log`
- **OpenBlock Desktop日志**: 开发者工具控制台

## 安全注意事项

1. **网络安全**: 确保在可信网络环境中使用
2. **设备安全**: 远程烧录会直接控制硬件设备
3. **访问控制**: 考虑在FangtangLink服务器上添加认证机制

## 开发和扩展

### 添加新功能

1. 修改`RemoteFlasherClient.js`添加新的API调用
2. 在`RemoteArduinoUploader.js`中实现新的烧录逻辑
3. 更新GUI界面添加新的配置选项

### 测试

```bash
# 运行完整测试套件
node test-remote-flasher.js

# 测试特定功能
node -e "require('./test-remote-flasher.js').testBasicFunctionality()"
```

## 贡献

欢迎提交Issue和Pull Request来改进远程烧录功能！

## 许可证

本功能基于OpenBlock Desktop和FangtangLink项目，遵循相应的开源许可证。
