const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const url = require('url');
const querystring = require('querystring');
const { spawn, exec } = require('child_process');

/**
 * FangtangLink远程烧录客户端
 * 提供与Raspberry Pi上的FangtangLink API服务器通信的功能
 */
class RemoteFlasherClient {
    constructor(serverUrl = 'http://localhost:5000', timeout = 30000) {
        this.serverUrl = serverUrl.replace(/\/$/, ''); // 移除末尾的斜杠
        this.timeout = timeout;
        this.debug = true; // 启用调试日志
        this.useCurlFallback = true; // 启用curl备用方案

        this.log('RemoteFlasherClient initialized');
        this.log(`Server URL: ${this.serverUrl}`);
        this.log(`Timeout: ${this.timeout}ms`);
        this.log(`Curl fallback: ${this.useCurlFallback ? 'enabled' : 'disabled'}`);
    }

    /**
     * 日志输出
     */
    log(message, data = null) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] RemoteFlasherClient: ${message}`);
        if (data) {
            console.log('Data:', JSON.stringify(data, null, 2));
        }
    }

    /**
     * 错误日志输出
     */
    logError(message, error = null) {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] RemoteFlasherClient ERROR: ${message}`);
        if (error) {
            console.error('Error details:', error);
        }
    }

    /**
     * 使用curl的HTTP请求方法（备用方案）
     */
    makeRequestWithCurl(method, path, data = null, headers = {}) {
        return new Promise((resolve, reject) => {
            const fullUrl = this.serverUrl + path;
            this.log(`Making ${method} request with curl to: ${fullUrl}`);

            const curlArgs = [
                '-X', method,
                '-H', 'User-Agent: OpenBlock-Desktop-RemoteFlasher/1.0',
                '-H', 'Accept: application/json',
                '--connect-timeout', '10',
                '--max-time', '30',
                '-s', // silent
                '-i', // include headers
                '--fail-with-body' // return body even on HTTP errors
            ];

            // 添加自定义头部
            for (const [key, value] of Object.entries(headers)) {
                curlArgs.push('-H', `${key}: ${value}`);
            }

            // 添加数据
            if (data && method !== 'GET') {
                if (typeof data === 'object') {
                    curlArgs.push('-H', 'Content-Type: application/json');
                    curlArgs.push('-d', JSON.stringify(data));
                } else {
                    curlArgs.push('-d', data);
                }
            }

            curlArgs.push(fullUrl);

            this.log('Curl command:', `curl ${curlArgs.join(' ')}`);

            const curl = spawn('curl', curlArgs);
            let stdout = '';
            let stderr = '';

            curl.stdout.on('data', (chunk) => {
                stdout += chunk;
            });

            curl.stderr.on('data', (chunk) => {
                stderr += chunk;
            });

            curl.on('close', (code) => {
                this.log(`Curl process exited with code: ${code}`);
                this.log('Curl stdout:', stdout);
                if (stderr) {
                    this.log('Curl stderr:', stderr);
                }

                if (code === 0) {
                    // 解析响应
                    const lines = stdout.split('\n');
                    let headerEndIndex = -1;
                    let statusCode = 200;

                    // 查找状态行和头部结束位置
                    for (let i = 0; i < lines.length; i++) {
                        if (lines[i].startsWith('HTTP/')) {
                            const statusMatch = lines[i].match(/HTTP\/[\d.]+\s+(\d+)/);
                            if (statusMatch) {
                                statusCode = parseInt(statusMatch[1]);
                            }
                        } else if (lines[i].trim() === '' && headerEndIndex === -1) {
                            headerEndIndex = i;
                            break;
                        }
                    }

                    // 提取响应体
                    const responseBody = headerEndIndex >= 0 ?
                        lines.slice(headerEndIndex + 1).join('\n').trim() :
                        stdout;

                    this.log('Parsed response body:', responseBody);

                    try {
                        const jsonData = JSON.parse(responseBody);
                        resolve({
                            success: true,
                            status: statusCode,
                            data: jsonData
                        });
                    } catch (parseError) {
                        this.log('Response is not JSON, returning as text');
                        resolve({
                            success: true,
                            status: statusCode,
                            data: responseBody
                        });
                    }
                } else {
                    this.logError('Curl request failed', { code, stderr });
                    reject({
                        success: false,
                        error: `Curl failed with code ${code}`,
                        stderr: stderr
                    });
                }
            });

            curl.on('error', (error) => {
                this.logError('Curl spawn error', error);
                reject({
                    success: false,
                    error: error.message
                });
            });
        });
    }

    /**
     * 通用HTTP请求方法
     */
    async makeRequest(method, path, data = null, headers = {}) {
        // 首先尝试原生Node.js HTTP
        try {
            const result = await this.makeRequestNative(method, path, data, headers);
            return result;
        } catch (error) {
            this.logError('Native HTTP request failed, trying curl fallback', error);

            if (this.useCurlFallback) {
                try {
                    const result = await this.makeRequestWithCurl(method, path, data, headers);
                    this.log('Curl fallback successful');
                    return result;
                } catch (curlError) {
                    this.logError('Curl fallback also failed', curlError);
                    throw curlError;
                }
            } else {
                throw error;
            }
        }
    }

    /**
     * 原生Node.js HTTP请求方法
     */
    makeRequestNative(method, path, data = null, headers = {}) {
        return new Promise((resolve, reject) => {
            const fullUrl = this.serverUrl + path;
            this.log(`Making ${method} request to: ${fullUrl}`);

            const parsedUrl = url.parse(fullUrl);
            const isHttps = parsedUrl.protocol === 'https:';
            const httpModule = isHttps ? https : http;

            const defaultHeaders = {
                'User-Agent': 'OpenBlock-Desktop-RemoteFlasher/1.0',
                'Accept': 'application/json',
                'Connection': 'close'
            };

            const requestHeaders = { ...defaultHeaders, ...headers };

            let postData = null;
            if (data && method !== 'GET') {
                if (typeof data === 'object' && !(data instanceof Buffer)) {
                    postData = JSON.stringify(data);
                    requestHeaders['Content-Type'] = 'application/json';
                } else {
                    postData = data;
                }
                if (postData) {
                    requestHeaders['Content-Length'] = Buffer.byteLength(postData);
                }
            }

            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (isHttps ? 443 : 80),
                path: parsedUrl.path,
                method: method,
                headers: requestHeaders,
                timeout: this.timeout,
                family: 4 // 强制IPv4
            };

            this.log('Request options:', options);
            if (postData) {
                this.log('Request data:', postData);
            }

            const req = httpModule.request(options, (res) => {
                this.log(`Response received - Status: ${res.statusCode}`);
                this.log('Response headers:', res.headers);

                let responseData = '';
                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    this.log('Response completed');
                    this.log('Raw response data:', responseData);

                    try {
                        const jsonData = JSON.parse(responseData);
                        resolve({
                            success: true,
                            status: res.statusCode,
                            data: jsonData,
                            headers: res.headers
                        });
                    } catch (parseError) {
                        this.log('Response is not JSON, returning as text');
                        resolve({
                            success: true,
                            status: res.statusCode,
                            data: responseData,
                            headers: res.headers
                        });
                    }
                });
            });

            req.on('error', (error) => {
                this.logError('Request failed', error);
                reject({
                    success: false,
                    error: error.message,
                    code: error.code,
                    errno: error.errno,
                    syscall: error.syscall,
                    address: error.address,
                    port: error.port
                });
            });

            req.on('timeout', () => {
                this.logError('Request timeout');
                req.destroy();
                reject({
                    success: false,
                    error: 'Request timeout',
                    code: 'TIMEOUT'
                });
            });

            if (postData) {
                req.write(postData);
            }

            req.end();
            this.log('Request sent');
        });
    }

    /**
     * 检查远程服务器状态
     */
    async getStatus() {
        this.log('Getting server status...');
        try {
            const response = await this.makeRequest('GET', '/status');
            this.log('Status request successful');
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            this.logError('Status request failed', error);
            return {
                success: false,
                error: error.error || error.message,
                message: 'Failed to connect to remote flasher server',
                details: error
            };
        }
    }

    /**
     * 获取服务器配置信息
     */
    async getConfig() {
        this.log('Getting server configuration...');
        try {
            const response = await this.makeRequest('GET', '/config');
            this.log('Config request successful');
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            this.logError('Config request failed', error);
            return {
                success: false,
                error: error.error || error.message,
                message: 'Failed to get server configuration'
            };
        }
    }

    /**
     * 上传并烧录hex文件
     */
    async flashFile(hexFilePath, options = {}) {
        this.log('Flashing file:', hexFilePath);
        try {
            if (!fs.existsSync(hexFilePath)) {
                return {
                    success: false,
                    message: `File not found: ${hexFilePath}`
                };
            }

            // 使用curl进行文件上传
            const curlArgs = [
                '-X', 'POST',
                '-H', 'User-Agent: OpenBlock-Desktop-RemoteFlasher/1.0',
                '-H', 'Accept: application/json',
                '--connect-timeout', '10',
                '--max-time', '120', // 烧录可能需要更长时间
                '-s', // silent
                '-i', // include headers
                '--fail-with-body', // return body even on HTTP errors
                '-F', `file=@${hexFilePath}` // 文件上传
            ];

            // 添加可选参数
            if (options.mcu) curlArgs.push('-F', `mcu=${options.mcu}`);
            if (options.programmer) curlArgs.push('-F', `programmer=${options.programmer}`);
            if (options.port) curlArgs.push('-F', `port=${options.port}`);
            if (options.baudrate) curlArgs.push('-F', `baudrate=${options.baudrate}`);

            curlArgs.push(`${this.serverUrl}/flash/file`);

            this.log('Curl command for file upload:', `curl ${curlArgs.join(' ')}`);

            const result = await new Promise((resolve, reject) => {
                const { spawn } = require('child_process');
                const curl = spawn('curl', curlArgs);
                let stdout = '';
                let stderr = '';

                curl.stdout.on('data', (chunk) => {
                    stdout += chunk;
                });

                curl.stderr.on('data', (chunk) => {
                    stderr += chunk;
                });

                curl.on('close', (code) => {
                    this.log(`Curl file upload process exited with code: ${code}`);
                    this.log('Curl stdout:', stdout);
                    if (stderr) {
                        this.log('Curl stderr:', stderr);
                    }

                    if (code === 0) {
                        // 解析响应
                        const lines = stdout.split('\n');
                        let headerEndIndex = -1;
                        let statusCode = 200;

                        // 查找状态行和头部结束位置
                        for (let i = 0; i < lines.length; i++) {
                            if (lines[i].startsWith('HTTP/')) {
                                const statusMatch = lines[i].match(/HTTP\/[\d.]+\s+(\d+)/);
                                if (statusMatch) {
                                    statusCode = parseInt(statusMatch[1]);
                                }
                            } else if (lines[i].trim() === '' && headerEndIndex === -1) {
                                headerEndIndex = i;
                                break;
                            }
                        }

                        // 提取响应体
                        const responseBody = headerEndIndex >= 0 ?
                            lines.slice(headerEndIndex + 1).join('\n').trim() :
                            stdout;

                        this.log('Parsed response body:', responseBody);

                        try {
                            const jsonData = JSON.parse(responseBody);
                            resolve({
                                success: true,
                                status: statusCode,
                                data: jsonData
                            });
                        } catch (parseError) {
                            this.log('Response is not JSON, returning as text');
                            resolve({
                                success: true,
                                status: statusCode,
                                data: responseBody
                            });
                        }
                    } else {
                        reject({
                            success: false,
                            error: `Curl failed with code ${code}`,
                            stderr: stderr
                        });
                    }
                });

                curl.on('error', (error) => {
                    this.logError('Curl spawn error', error);
                    reject({
                        success: false,
                        error: error.message
                    });
                });
            });

            return {
                success: true,
                data: result.data
            };
        } catch (error) {
            this.logError('Flash file failed', error);
            return {
                success: false,
                error: error.error || error.message,
                message: 'Failed to flash file to remote device'
            };
        }
    }

    /**
     * 从URL烧录hex文件
     */
    async flashUrl(url, options = {}) {
        this.log('Flashing from URL:', url);
        try {
            const requestData = {
                url: url,
                ...options
            };

            const response = await this.makeRequest('POST', '/flash/url', requestData);

            if (response.success && response.status === 200) {
                this.log('Flash URL request successful');
                return {
                    success: true,
                    data: response.data
                };
            } else {
                this.logError('Flash URL request failed', response);
                return {
                    success: false,
                    error: response.data || 'Unknown error',
                    message: 'Failed to flash from URL to remote device'
                };
            }
        } catch (error) {
            this.logError('Flash URL request error', error);
            return {
                success: false,
                error: error.error || error.message,
                message: 'Failed to flash from URL to remote device'
            };
        }
    }

    /**
     * 获取设备信息
     */
    async getDeviceInfo(options = {}) {
        this.log('Getting device info...', options);
        try {
            const params = new URLSearchParams();
            if (options.mcu) params.append('mcu', options.mcu);
            if (options.programmer) params.append('programmer', options.programmer);
            if (options.port) params.append('port', options.port);
            if (options.baudrate) params.append('baudrate', options.baudrate.toString());

            const response = await this.makeRequest('GET', `/device/info?${params.toString()}`);

            if (response.success && response.status === 200) {
                this.log('Device info request successful');
                return {
                    success: true,
                    data: response.data
                };
            } else {
                this.logError('Device info request failed', response);
                return {
                    success: false,
                    error: response.data || 'Unknown error',
                    message: 'Failed to get device information'
                };
            }
        } catch (error) {
            this.logError('Device info request error', error);
            return {
                success: false,
                error: error.error || error.message,
                message: 'Failed to get device information'
            };
        }
    }

    /**
     * 控制设备复位
     */
    async controlReset(reset = true, duration = 0.2) {
        this.log('Controlling device reset...', { reset, duration });
        try {
            const requestData = {
                reset: reset,
                duration: duration
            };

            const response = await this.makeRequest('POST', '/control/reset', requestData);

            if (response.success && response.status === 200) {
                this.log('Reset control request successful');
                return {
                    success: true,
                    data: response.data
                };
            } else {
                this.logError('Reset control request failed', response);
                return {
                    success: false,
                    error: response.data || 'Unknown error',
                    message: 'Failed to control device reset'
                };
            }
        } catch (error) {
            this.logError('Reset control request error', error);
            return {
                success: false,
                error: error.error || error.message,
                message: 'Failed to control device reset'
            };
        }
    }



    /**
     * 执行完整的Arduino操作（推荐使用）
     */
    async performArduinoOperation(hexFilePath, options = {}, onData = null) {
        this.log('Starting Arduino operation...', { hexFilePath, options });
        try {
            if (!fs.existsSync(hexFilePath)) {
                return {
                    success: false,
                    message: `File not found: ${hexFilePath}`
                };
            }

            // 使用curl进行文件上传到Arduino操作端点
            const curlArgs = [
                '-X', 'POST',
                '-H', 'User-Agent: OpenBlock-Desktop-RemoteFlasher/1.0',
                '-H', 'Accept: text/plain',
                '--connect-timeout', '10',
                '--max-time', '120', // Arduino操作可能需要更长时间
                '-N', // 禁用缓冲，实时输出
                '--fail-with-body', // return body even on HTTP errors
                '-F', `file=@${hexFilePath}` // 文件上传
            ];

            // 添加可选参数
            if (options.mcu) curlArgs.push('-F', `mcu=${options.mcu}`);
            if (options.programmer) curlArgs.push('-F', `programmer=${options.programmer}`);
            if (options.port) curlArgs.push('-F', `port=${options.port}`);
            if (options.baudrate) curlArgs.push('-F', `baudrate=${options.baudrate}`);

            // 构建查询参数
            const queryParams = new URLSearchParams();
            if (options.mcu) queryParams.append('mcu', options.mcu);
            if (options.programmer) queryParams.append('programmer', options.programmer);
            if (options.port) queryParams.append('port', options.port);
            if (options.baudrate) queryParams.append('baudrate', options.baudrate);

            const url = `${this.serverUrl}/flash/stream?${queryParams.toString()}`;
            curlArgs.push(url);

            this.log('Curl command for stream operation:', `curl ${curlArgs.join(' ')}`);

            return new Promise((resolve, reject) => {
                const { spawn } = require('child_process');
                const curl = spawn('curl', curlArgs);
                let hasError = false;
                let lastMessage = '';
                let isSuccess = false;
                let successMessage = ''; // 专门记录成功消息
                let allMessages = []; // 记录所有消息用于最终判断

                curl.stdout.on('data', (chunk) => {
                    const data = chunk.toString();

                    // 解析流式数据
                    const lines = data.split('\n');
                    for (const line of lines) {
                        if (line.trim().startsWith('data: ')) {
                            try {
                                const jsonStr = line.trim().substring(6); // 移除 "data: " 前缀
                                const streamData = JSON.parse(jsonStr);

                                // 实时输出格式化的消息
                                if (onData) {
                                    this.formatStreamMessage(streamData, onData);
                                }

                                // 记录消息和状态
                                const message = streamData.message || '';
                                allMessages.push(message); // 记录所有消息

                                // 检查消息内容来判断成功状态
                                if (message.includes('Flash completed successfully')) {
                                    isSuccess = true;
                                    successMessage = message;
                                    this.log('Found success message:', message);
                                } else if (streamData.type === 'error' || message.includes('Flash failed')) {
                                    hasError = true;
                                    lastMessage = message || 'Flash operation failed';
                                    this.log('Found error message:', message);
                                }

                                // 更新最后消息
                                lastMessage = message;

                            } catch (parseError) {
                                // 忽略解析错误，可能是不完整的数据
                            }
                        }
                    }
                });

                curl.stderr.on('data', (chunk) => {
                    const errorData = chunk.toString();
                    this.log('Curl stderr:', errorData);
                    hasError = true;
                });

                curl.on('close', (code) => {
                    this.log(`Curl stream operation process exited with code: ${code}`);
                    this.log(`Final state - isSuccess: ${isSuccess}, hasError: ${hasError}, successMessage: "${successMessage}"`);
                    this.log(`All messages: ${JSON.stringify(allMessages)}`);

                    // 最终检查：在所有消息中查找成功标志
                    let finalSuccess = isSuccess;
                    let finalSuccessMessage = successMessage;

                    if (!finalSuccess) {
                        // 如果还没有找到成功标志，再次检查所有消息
                        for (const msg of allMessages) {
                            if (msg.includes('Flash completed successfully')) {
                                finalSuccess = true;
                                finalSuccessMessage = msg;
                                this.log('Found success in final check:', msg);
                                break;
                            }
                        }
                    }

                    if (code === 0 && finalSuccess) {
                        // 找到成功消息
                        resolve({
                            success: true,
                            message: finalSuccessMessage,
                            data: { success: true, message: finalSuccessMessage }
                        });
                    } else if (hasError || code !== 0) {
                        // 明确的错误状态或curl进程错误
                        const errorMsg = hasError ? lastMessage : `Stream operation failed with code ${code}`;
                        reject({
                            success: false,
                            error: errorMsg,
                            message: errorMsg
                        });
                    } else {
                        // 没有找到明确的成功或错误标志
                        reject({
                            success: false,
                            error: 'No clear success or error indication found',
                            message: lastMessage || 'Unknown operation result'
                        });
                    }
                });

                curl.on('error', (error) => {
                    this.logError('Curl spawn error', error);
                    reject({
                        success: false,
                        error: error.message,
                        message: 'Failed to start stream operation'
                    });
                });
            });
        } catch (error) {
            this.logError('Arduino operation error', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to start Arduino operation'
            };
        }
    }

    /**
     * 格式化流式消息输出
     */
    formatStreamMessage(streamData, onData) {
        const { type, message } = streamData;

        let formattedMessage = '';

        switch (type) {
            case 'info':
                formattedMessage = `ℹ️  ${message}`;
                break;
            case 'output':
                // 格式化avrdude输出
                if (message.includes('avrdude: Version')) {
                    formattedMessage = `📋 ${message}`;
                } else if (message.includes('device signature')) {
                    formattedMessage = `🔍 ${message}`;
                } else if (message.includes('writing') && message.includes('flash')) {
                    formattedMessage = `📝 ${message}`;
                } else if (message.includes('Writing |') || message.includes('Reading |')) {
                    formattedMessage = `⏳ ${message}`;
                } else if (message.includes('bytes of flash written')) {
                    formattedMessage = `✅ ${message}`;
                } else if (message.includes('bytes of flash verified')) {
                    formattedMessage = `✅ ${message}`;
                } else if (message.includes('avrdude done')) {
                    formattedMessage = `🎉 ${message}`;
                } else {
                    formattedMessage = `   ${message}`;
                }
                break;
            case 'success':
                formattedMessage = `🎉 ${message}`;
                break;
            case 'error':
                formattedMessage = `❌ ${message}`;
                break;
            default:
                formattedMessage = `   ${message}`;
        }

        onData(formattedMessage + '\n');
    }

    /**
     * 流式烧录（实时获取输出）
     */
    async flashFileStream(hexFilePath, options = {}, onData = null) {
        this.log('Starting stream flash operation...', { hexFilePath, options });
        try {
            if (!fs.existsSync(hexFilePath)) {
                return {
                    success: false,
                    message: `File not found: ${hexFilePath}`
                };
            }

            // 使用curl进行流式文件上传
            const curlArgs = [
                '-X', 'POST',
                '-H', 'User-Agent: OpenBlock-Desktop-RemoteFlasher/1.0',
                '-H', 'Accept: text/plain',
                '--connect-timeout', '10',
                '--max-time', '120', // 烧录可能需要更长时间
                '-N', // 禁用缓冲，实时输出
                '--fail-with-body', // return body even on HTTP errors
                '-F', `file=@${hexFilePath}` // 文件上传
            ];

            // 添加可选参数
            if (options.mcu) curlArgs.push('-F', `mcu=${options.mcu}`);
            if (options.programmer) curlArgs.push('-F', `programmer=${options.programmer}`);
            if (options.port) curlArgs.push('-F', `port=${options.port}`);
            if (options.baudrate) curlArgs.push('-F', `baudrate=${options.baudrate}`);

            curlArgs.push(`${this.serverUrl}/flash/stream`);

            this.log('Curl command for stream upload:', `curl ${curlArgs.join(' ')}`);

            return new Promise((resolve, reject) => {
                const { spawn } = require('child_process');
                const curl = spawn('curl', curlArgs);
                let output = '';
                let hasError = false;

                curl.stdout.on('data', (chunk) => {
                    const data = chunk.toString();
                    output += data;
                    if (onData) {
                        onData(data);
                    }
                });

                curl.stderr.on('data', (chunk) => {
                    const errorData = chunk.toString();
                    this.log('Curl stderr:', errorData);
                    hasError = true;
                });

                curl.on('close', (code) => {
                    this.log(`Curl stream process exited with code: ${code}`);

                    if (code === 0 && !hasError) {
                        resolve({
                            success: true,
                            output: output
                        });
                    } else {
                        reject({
                            success: false,
                            error: `Curl failed with code ${code}`,
                            output: output
                        });
                    }
                });

                curl.on('error', (error) => {
                    this.logError('Curl spawn error', error);
                    reject({
                        success: false,
                        error: error.message,
                        message: 'Failed to start stream flash operation'
                    });
                });
            });
        } catch (error) {
            this.logError('Stream flash operation error', error);
            return {
                success: false,
                error: error.message,
                message: 'Failed to start stream flash operation'
            };
        }
    }

    /**
     * 等待服务可用
     */
    async waitForService(maxWait = 30) {
        const startTime = Date.now();
        const interval = 1000; // 1秒检查一次

        while (Date.now() - startTime < maxWait * 1000) {
            const status = await this.getStatus();
            if (status.success) {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, interval));
        }
        return false;
    }

    /**
     * 测试连接
     */
    async testConnection() {
        this.log('Testing connection to remote flasher server...');

        const status = await this.getStatus();
        if (!status.success) {
            this.logError('Status check failed during connection test');
            return {
                success: false,
                message: 'Cannot connect to remote flasher server',
                error: status.error
            };
        }

        const config = await this.getConfig();
        if (!config.success) {
            this.logError('Config check failed during connection test');
            return {
                success: false,
                message: 'Cannot get server configuration',
                error: config.error
            };
        }

        this.log('Connection test successful');
        return {
            success: true,
            message: 'Remote flasher server is available',
            serverInfo: {
                status: status.data,
                config: config.data
            }
        };
    }
}

module.exports = RemoteFlasherClient;
