const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

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
        if (!fs.existsSync(this._codeFolderPath)) {
            fs.mkdirSync(this._codeFolderPath, {recursive: true});
        }

        if (!fs.existsSync(this._buildPath)) {
            fs.mkdirSync(this._buildPath, {recursive: true});
        }

        try {
            // 保存代码文件
            fs.writeFileSync(this._codeFilePath, code);
            this._sendstd('Code saved, starting compilation...\n');

            // 使用arduino-cli进行编译
            return await this.compileWithArduinoCli();
        } catch (err) {
            throw err;
        }
    }

    /**
     * 使用arduino-cli编译代码
     */
    async compileWithArduinoCli() {
        const arduinoCliPath = this.getArduinoCliPath();

        // 检查arduino-cli是否真的存在
        if (arduinoCliPath === 'arduino-cli') {
            // 如果返回的是默认名称，先测试是否可用
            try {
                const { execSync } = require('child_process');
                execSync('arduino-cli version', { stdio: 'pipe' });
                this._sendstd('Found arduino-cli in system PATH\n');
            } catch (error) {
                this._sendstd('Arduino CLI not found in system PATH\n');
                this._sendstd('Please install Arduino CLI:\n');
                this._sendstd('  macOS: brew install arduino-cli\n');
                this._sendstd('  Linux: curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh\n');
                this._sendstd('  Windows: Download from https://github.com/arduino/arduino-cli/releases\n');
                throw new Error('Arduino CLI not found. Please install arduino-cli.');
            }
        }

        // 确保必要的平台已安装
        await this.ensureArduinoPlatforms(arduinoCliPath);

        return new Promise((resolve, reject) => {
            const args = [
                'compile',
                '--fqbn', this._config.fqbn,
                '--build-path', this._buildPath,
                '--output-dir', this._buildPath,
                this._codeFolderPath
            ];

            this._sendstd(`Compiling with: ${arduinoCliPath} ${args.join(' ')}\n`);

            const process = spawn(arduinoCliPath, args, {
                cwd: this._codeFolderPath,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let output = '';
            let errorOutput = '';

            process.stdout.on('data', (data) => {
                const text = data.toString();
                output += text;
                this._sendstd(text);
            });

            process.stderr.on('data', (data) => {
                const text = data.toString();
                errorOutput += text;
                this._sendstd(text);
            });

            process.on('close', (code) => {
                if (code === 0) {
                    this._sendstd('Local compilation successful!\n');
                    resolve('Success');
                } else {
                    this._sendstd(`Local compilation failed with code ${code}\n`);
                    reject(new Error(`Compilation failed: ${errorOutput || output}`));
                }
            });

            process.on('error', (error) => {
                this._sendstd(`Local compilation error: ${error.message}\n`);
                reject(error);
            });
        });
    }

    /**
     * 确保必要的Arduino平台已安装
     */
    async ensureArduinoPlatforms(arduinoCliPath) {
        const { execSync } = require('child_process');

        try {
            // 检查系统架构
            const arch = os.arch();
            const platform = os.platform();

            this._sendstd(`System: ${platform} ${arch}\n`);

            // 在Apple Silicon Mac上，检查是否需要使用Rosetta
            if (platform === 'darwin' && arch === 'arm64') {
                this._sendstd('Detected Apple Silicon Mac. Arduino CLI tools may need Rosetta 2.\n');

                // 检查是否安装了Rosetta 2
                try {
                    execSync('pgrep oahd', { stdio: 'pipe' });
                    this._sendstd('Rosetta 2 is available.\n');
                } catch (error) {
                    this._sendstd('Warning: Rosetta 2 may not be installed. Some Arduino tools may not work.\n');
                    this._sendstd('To install Rosetta 2, run: softwareupdate --install-rosetta\n');
                }
            }

            // 获取FQBN中的平台信息
            const platformName = this.getPlatformFromFqbn();

            this._sendstd(`Checking if platform ${platformName} is installed...\n`);

            // 检查平台是否已安装
            try {
                const installedPlatforms = execSync(`"${arduinoCliPath}" core list`, { encoding: 'utf8' });
                if (installedPlatforms.includes(platformName)) {
                    this._sendstd(`Platform ${platformName} is already installed\n`);

                    // 在Apple Silicon上，尝试测试编译工具是否工作
                    if (platform === 'darwin' && arch === 'arm64') {
                        return await this.testCompilerCompatibility(arduinoCliPath, platformName);
                    }
                    return;
                }
            } catch (error) {
                // 继续安装
            }

            this._sendstd(`Installing platform ${platformName}...\n`);

            // 更新索引
            this._sendstd('Updating package index...\n');
            execSync(`"${arduinoCliPath}" core update-index`, {
                stdio: ['pipe', 'pipe', 'pipe'],
                encoding: 'utf8'
            });

            // 安装平台
            this._sendstd(`Installing ${platformName}...\n`);
            const installOutput = execSync(`"${arduinoCliPath}" core install ${platformName}`, {
                encoding: 'utf8',
                stdio: ['pipe', 'pipe', 'pipe']
            });

            this._sendstd(installOutput);
            this._sendstd(`Platform ${platformName} installed successfully!\n`);

            // 在Apple Silicon上，测试编译工具兼容性
            if (platform === 'darwin' && arch === 'arm64') {
                await this.testCompilerCompatibility(arduinoCliPath, platformName);
            }

        } catch (error) {
            this._sendstd(`Warning: Failed to install platform: ${error.message}\n`);

            // 在Apple Silicon上提供特殊建议
            if (os.platform() === 'darwin' && os.arch() === 'arm64') {
                this._sendstd('\nApple Silicon Mac detected. Try these solutions:\n');
                this._sendstd('1. Install Rosetta 2: softwareupdate --install-rosetta\n');
                this._sendstd('2. Use Arduino IDE 2.x which has native ARM64 support\n');
                this._sendstd('3. Or use remote compilation (will skip local compilation)\n');
            }

            this._sendstd('You may need to install the platform manually:\n');
            this._sendstd(`  arduino-cli core install ${this.getPlatformFromFqbn()}\n`);
            // 不抛出错误，让编译继续尝试
        }
    }

    /**
     * 从FQBN获取平台信息
     */
    getPlatformFromFqbn() {
        // FQBN格式: vendor:architecture:board[:parameters]
        // 例如: arduino:avr:nano:cpu=atmega328old
        const parts = this._config.fqbn.split(':');
        if (parts.length >= 2) {
            return `${parts[0]}:${parts[1]}`;
        }
        return 'arduino:avr'; // 默认
    }

    /**
     * 测试编译工具兼容性（Apple Silicon特定）
     */
    async testCompilerCompatibility(arduinoCliPath, platformName) {
        const { execSync } = require('child_process');
        const os = require('os');

        try {
            const platform = os.platform();
            const arch = os.arch();

            this._sendstd(`System: ${platform} ${arch}\n`);

            if (platform === 'darwin' && arch === 'arm64') {
                this._sendstd('Detected Apple Silicon Mac. Arduino CLI tools may need Rosetta 2.\n');

                // 检查Rosetta 2是否可用
                try {
                    execSync('arch -x86_64 uname -m', { stdio: 'pipe' });
                    this._sendstd('Rosetta 2 is available.\n');
                } catch (error) {
                    this._sendstd('Rosetta 2 is not available. Some Arduino tools may not work.\n');
                    this._sendstd('Install Rosetta 2 with: softwareupdate --install-rosetta\n');
                }
            }

        } catch (error) {
            this._sendstd(`Apple Silicon Mac detected. Try these solutions:\n`);
            this._sendstd(`1. Install Rosetta 2: softwareupdate --install-rosetta\n`);
            this._sendstd(`2. Use Arduino IDE 2.x which has native ARM64 support\n`);
            this._sendstd(`3. Or use remote compilation (will skip local compilation)\n`);
            throw error;
        }
    }

    /**
     * 获取arduino-cli路径
     */
    getArduinoCliPath() {
        // 根据平台查找arduino-cli
        const platform = os.platform();
        let cliName = 'arduino-cli';

        if (platform === 'win32') {
            cliName = 'arduino-cli.exe';
        }

        // 可能的arduino-cli路径
        const possiblePaths = [
            // tools目录中的arduino-cli
            path.join(this._toolsPath, 'arduino-cli', cliName),
            path.join(this._toolsPath, 'arduino-cli', 'bin', cliName),
            path.join(this._toolsPath, cliName),
            // 系统常见路径
            `/usr/local/bin/${cliName}`,
            `/usr/bin/${cliName}`,
            `/opt/homebrew/bin/${cliName}`,
            // macOS应用程序路径
            `/Applications/Arduino IDE.app/Contents/MacOS/arduino-cli`,
            `/Applications/Arduino.app/Contents/Java/tools/arduino-cli`,
        ];

        // 检查每个可能的路径
        for (const cliPath of possiblePaths) {
            if (fs.existsSync(cliPath)) {
                this._sendstd(`Found arduino-cli at: ${cliPath}\n`);
                return cliPath;
            }
        }

        // 如果都找不到，尝试使用which命令查找
        try {
            const { execSync } = require('child_process');
            const whichResult = execSync(`which ${cliName}`, { encoding: 'utf8' }).trim();
            if (whichResult && fs.existsSync(whichResult)) {
                this._sendstd(`Found arduino-cli via which: ${whichResult}\n`);
                return whichResult;
            }
        } catch (error) {
            // which命令失败，继续
        }

        // 最后尝试系统PATH
        this._sendstd(`Arduino-cli not found in common paths, trying system PATH...\n`);
        return cliName;
    }

    /**
     * 远程烧录
     */
    async flash(firmwarePath = null) {
        if (this._abort) {
            return 'Aborted';
        }

        try {
            this._sendstd('Using remote flasher for upload...\n');

            // 测试连接
            this._sendstd('Testing remote flasher connection...\n');
            const connectionTest = await this._remoteFlasherClient.testConnection();
            if (!connectionTest.success) {
                throw new Error(`Connection failed: ${connectionTest.message}`);
            }
            this._sendstd('Remote flasher connection OK\n');

            let hexFilePath;
            if (firmwarePath) {
                // 如果提供了固件路径，直接使用
                hexFilePath = firmwarePath;
                this._sendstd(`Using provided firmware: ${hexFilePath}\n`);
            } else {
                // 查找本地编译生成的hex文件
                hexFilePath = this.findHexFile();

                if (!hexFilePath) {
                    throw new Error('No hex file found for flashing. Please ensure compilation was successful.');
                }

                this._sendstd(`Found local hex file: ${hexFilePath}\n`);
            }

            this._sendstd(`Starting remote Arduino operation...\n`);

            // 准备Arduino操作选项
            const operationOptions = {
                mcu: this.getMcuFromFqbn(),
                programmer: 'arduino',
                port: '/dev/ttyS0', // 使用正确的串口
                baudrate: 115200
            };

            // 使用流式Arduino操作API
            this._sendstd('Starting Arduino stream operation via API...\n');
            const result = await this._remoteFlasherClient.performArduinoOperation(
                hexFilePath,
                operationOptions,
                (data) => {
                    // 实时输出格式化的操作过程
                    this._sendstd(data);
                }
            );

            if (result.success) {
                this._sendstd('\n🎉 Remote Arduino operation completed successfully!\n');
                if (result.message) {
                    this._sendstd(`Final message: ${result.message}\n`);
                }
                return 'Success';
            } else {
                throw new Error(result.error || result.message || 'Stream operation failed');
            }

        } catch (error) {
            const errorMessage = error.message || 'Unknown error';
            this._sendstd(`Remote Arduino operation failed: ${errorMessage}\n`);
            throw new Error(`Remote Arduino operation failed: ${errorMessage}`);
        }
    }



    /**
     * 格式化avrdude输出
     */
    formatAvrdudeOutput(output) {
        if (!output) return '';

        // 移除多余的空行和格式化输出
        const lines = output.split('\n');
        const formattedLines = [];

        for (let line of lines) {
            line = line.trim();
            if (line) {
                // 高亮重要信息
                if (line.includes('avrdude: Version')) {
                    formattedLines.push(`📋 ${line}`);
                } else if (line.includes('device signature')) {
                    formattedLines.push(`🔍 ${line}`);
                } else if (line.includes('writing') && line.includes('flash')) {
                    formattedLines.push(`📝 ${line}`);
                } else if (line.includes('Writing |') || line.includes('Reading |')) {
                    formattedLines.push(`⏳ ${line}`);
                } else if (line.includes('bytes of flash written')) {
                    formattedLines.push(`✅ ${line}`);
                } else if (line.includes('bytes of flash verified')) {
                    formattedLines.push(`✅ ${line}`);
                } else if (line.includes('avrdude done')) {
                    formattedLines.push(`🎉 ${line}`);
                } else if (line.includes('error') || line.includes('Error')) {
                    formattedLines.push(`❌ ${line}`);
                } else {
                    formattedLines.push(`   ${line}`);
                }
            }
        }

        return formattedLines.join('\n');
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
