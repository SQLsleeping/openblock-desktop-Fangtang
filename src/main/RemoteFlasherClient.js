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
        try {
            const requestData = {
                url: url,
                ...options
            };

            const response = await this.axios.post(`${this.serverUrl}/flash/url`, requestData, {
                timeout: 120000 // 烧录可能需要更长时间
            });

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: 'Failed to flash from URL to remote device'
            };
        }
    }

    /**
     * 获取设备信息
     */
    async getDeviceInfo(options = {}) {
        try {
            const params = new URLSearchParams();
            if (options.mcu) params.append('mcu', options.mcu);
            if (options.programmer) params.append('programmer', options.programmer);
            if (options.port) params.append('port', options.port);
            if (options.baudrate) params.append('baudrate', options.baudrate.toString());

            const response = await this.axios.get(`${this.serverUrl}/device/info?${params.toString()}`);
            
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: 'Failed to get device information'
            };
        }
    }

    /**
     * 控制设备复位
     */
    async controlReset(reset = true, duration = 0.2) {
        try {
            const requestData = {
                reset: reset,
                duration: duration
            };

            const response = await this.axios.post(`${this.serverUrl}/control/reset`, requestData);
            
            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: 'Failed to control device reset'
            };
        }
    }

    /**
     * 流式烧录（实时获取输出）
     */
    async flashFileStream(hexFilePath, options = {}, onData = null) {
        try {
            if (!fs.existsSync(hexFilePath)) {
                return {
                    success: false,
                    message: `File not found: ${hexFilePath}`
                };
            }

            const formData = new FormData();
            formData.append('file', fs.createReadStream(hexFilePath));
            
            // 添加可选参数
            if (options.mcu) formData.append('mcu', options.mcu);
            if (options.programmer) formData.append('programmer', options.programmer);
            if (options.port) formData.append('port', options.port);
            if (options.baudrate) formData.append('baudrate', options.baudrate.toString());

            const response = await this.axios.post(`${this.serverUrl}/flash/stream`, formData, {
                headers: {
                    ...formData.getHeaders()
                },
                timeout: 120000,
                responseType: 'stream'
            });

            return new Promise((resolve, reject) => {
                let output = '';
                
                response.data.on('data', (chunk) => {
                    const data = chunk.toString();
                    output += data;
                    if (onData) {
                        onData(data);
                    }
                });

                response.data.on('end', () => {
                    resolve({
                        success: true,
                        output: output
                    });
                });

                response.data.on('error', (error) => {
                    reject({
                        success: false,
                        error: error.message,
                        message: 'Stream error during flash operation'
                    });
                });
            });
        } catch (error) {
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
