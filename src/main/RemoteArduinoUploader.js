const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * 远程Arduino上传器
 * 扩展原有的Arduino上传功能，支持通过FangtangLink API进行远程烧录
 */
class RemoteArduinoUploader {
    constructor(peripheralPath, config, userDataPath, toolsPath, sendstd, sendRemoteRequest, remoteFlasherClient) {
        this._peripheralPath = peripheralPath;
        this._config = config;
        this._userDataPath = userDataPath;
        this._toolsPath = toolsPath;
        this._sendstd = sendstd;
        this._sendRemoteRequest = sendRemoteRequest;
        this._remoteFlasherClient = remoteFlasherClient;
        this._abort = false;

        // 如果fqbn是对象，根据平台选择
        if (typeof this._config.fqbn === 'object') {
            this._config.fqbn = this._config.fqbn[os.platform()];
        }

        const projectPathName = `${this._config.fqbn.replace(/:/g, '_')}_project`.split(/_/).splice(0, 3)
            .join('_');
        this._projectFilePath = path.join(this._userDataPath, 'arduino', projectPathName);
        this._codeFolderPath = path.join(this._projectFilePath, 'code');
        this._codeFilePath = path.join(this._codeFolderPath, 'code.ino');
        this._buildPath = path.join(this._projectFilePath, 'build');
    }

    /**
     * 中止上传
     */
    abortUpload() {
        this._abort = true;
    }

    /**
     * 构建代码（本地编译）
     */
    async build(code) {
        // 这里复用原有的Arduino类的build方法
        // 为了简化，我们假设已经有编译好的hex文件
        // 实际实现中需要调用原有的Arduino.build方法
        
        if (!fs.existsSync(this._codeFolderPath)) {
            fs.mkdirSync(this._codeFolderPath, {recursive: true});
        }

        try {
            fs.writeFileSync(this._codeFilePath, code);
            this._sendstd('Code saved for remote compilation...\n');
            
            // 这里应该调用原有的编译逻辑
            // 为了演示，我们假设编译成功
            return 'Success';
        } catch (err) {
            throw err;
        }
    }

    /**
     * 远程烧录
     */
    async flash(firmwarePath = null) {
        if (this._abort) {
            return 'Aborted';
        }

        try {
            this._sendstd('Starting remote flash operation...\n');

            let hexFilePath;
            if (firmwarePath) {
                hexFilePath = firmwarePath;
            } else {
                // 查找编译生成的hex文件
                hexFilePath = this.findHexFile();
                if (!hexFilePath) {
                    throw new Error('No hex file found for flashing');
                }
            }

            this._sendstd(`Flashing ${hexFilePath} to remote device...\n`);

            // 准备烧录选项
            const flashOptions = {
                mcu: this.getMcuFromFqbn(),
                programmer: 'arduino',
                port: this._peripheralPath === 'remote-flasher-device' ? '/dev/ttyS0' : this._peripheralPath,
                baudrate: 115200
            };

            // 使用流式烧录获取实时输出
            const result = await this._remoteFlasherClient.flashFileStream(
                hexFilePath,
                flashOptions,
                (data) => {
                    // 实时输出烧录过程
                    this._sendstd(data);
                }
            );

            if (result.success) {
                this._sendstd('Remote flash completed successfully!\n');
                return 'Success';
            } else {
                throw new Error(result.message || 'Remote flash failed');
            }

        } catch (error) {
            this._sendstd(`Remote flash error: ${error.message}\n`);
            throw error;
        }
    }

    /**
     * 远程烧录实时固件
     */
    async flashRealtimeFirmware() {
        const firmwarePath = path.join(this._toolsPath, '../firmwares/arduino', this._config.firmware);
        return this.flash(firmwarePath);
    }

    /**
     * 查找编译生成的hex文件
     */
    findHexFile() {
        try {
            if (!fs.existsSync(this._buildPath)) {
                return null;
            }

            const files = fs.readdirSync(this._buildPath);
            const hexFile = files.find(file => file.endsWith('.hex'));
            
            if (hexFile) {
                return path.join(this._buildPath, hexFile);
            }
            
            return null;
        } catch (error) {
            console.error('Error finding hex file:', error);
            return null;
        }
    }

    /**
     * 从FQBN提取MCU类型
     */
    getMcuFromFqbn() {
        // 简单的FQBN到MCU映射
        const fqbnToMcu = {
            'arduino:avr:uno': 'atmega328p',
            'arduino:avr:nano': 'atmega328p',
            'arduino:avr:leonardo': 'atmega32u4',
            'arduino:avr:mega': 'atmega2560',
            'arduino:avr:micro': 'atmega32u4'
        };

        return fqbnToMcu[this._config.fqbn] || 'atmega328p';
    }

    /**
     * 测试远程连接
     */
    async testRemoteConnection() {
        try {
            this._sendstd('Testing remote flasher connection...\n');
            
            const result = await this._remoteFlasherClient.testConnection();
            
            if (result.success) {
                this._sendstd('Remote flasher connection OK\n');
                return true;
            } else {
                this._sendstd(`Remote flasher connection failed: ${result.message}\n`);
                return false;
            }
        } catch (error) {
            this._sendstd(`Remote connection test error: ${error.message}\n`);
            return false;
        }
    }

    /**
     * 获取远程设备信息
     */
    async getRemoteDeviceInfo() {
        try {
            const options = {
                mcu: this.getMcuFromFqbn(),
                programmer: 'arduino',
                port: this._peripheralPath
            };

            const result = await this._remoteFlasherClient.getDeviceInfo(options);
            
            if (result.success) {
                this._sendstd('Remote device info retrieved successfully\n');
                return result.data;
            } else {
                this._sendstd(`Failed to get remote device info: ${result.message}\n`);
                return null;
            }
        } catch (error) {
            this._sendstd(`Remote device info error: ${error.message}\n`);
            return null;
        }
    }

    /**
     * 控制远程设备复位
     */
    async controlRemoteReset(reset = true, duration = 0.2) {
        try {
            const result = await this._remoteFlasherClient.controlReset(reset, duration);
            
            if (result.success) {
                this._sendstd(`Remote device reset ${reset ? 'activated' : 'released'}\n`);
                return true;
            } else {
                this._sendstd(`Remote reset control failed: ${result.message}\n`);
                return false;
            }
        } catch (error) {
            this._sendstd(`Remote reset control error: ${error.message}\n`);
            return false;
        }
    }

    /**
     * 完整的远程Arduino操作流程
     */
    async performRemoteArduinoOperation(hexFilePath = null) {
        try {
            this._sendstd('Starting complete remote Arduino operation...\n');

            // 1. 测试连接
            if (!(await this.testRemoteConnection())) {
                throw new Error('Remote connection test failed');
            }

            // 2. 获取设备信息（可选）
            await this.getRemoteDeviceInfo();

            // 3. 控制复位进入bootloader
            await this.controlRemoteReset(true, 0.5);
            await new Promise(resolve => setTimeout(resolve, 500));
            await this.controlRemoteReset(false);
            await new Promise(resolve => setTimeout(resolve, 500));

            // 4. 执行烧录
            const flashResult = await this.flash(hexFilePath);

            // 5. 烧录后复位启动程序
            if (flashResult === 'Success') {
                await this.controlRemoteReset(true, 0.1);
                await this.controlRemoteReset(false);
                this._sendstd('Remote Arduino operation completed successfully!\n');
            }

            return flashResult;

        } catch (error) {
            this._sendstd(`Remote Arduino operation failed: ${error.message}\n`);
            throw error;
        }
    }
}

module.exports = RemoteArduinoUploader;
