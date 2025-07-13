#!/usr/bin/env node

/**
 * 使用原生Node.js HTTP模块测试连接
 */

const http = require('http');
const url = require('url');

const SERVER_URL = 'http://192.168.0.109:5000';

function makeHttpRequest(path = '/status') {
    return new Promise((resolve, reject) => {
        const fullUrl = SERVER_URL + path;
        console.log(`Making request to: ${fullUrl}`);
        
        const parsedUrl = url.parse(fullUrl);
        
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 80,
            path: parsedUrl.path,
            method: 'GET',
            headers: {
                'User-Agent': 'OpenBlock-Desktop-Test/1.0',
                'Accept': 'application/json'
            },
            timeout: 10000
        };

        console.log('Request options:', options);

        const req = http.request(options, (res) => {
            console.log(`Response status: ${res.statusCode}`);
            console.log('Response headers:', res.headers);
            
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve({
                        success: true,
                        status: res.statusCode,
                        data: jsonData
                    });
                } catch (error) {
                    resolve({
                        success: true,
                        status: res.statusCode,
                        data: data
                    });
                }
            });
        });

        req.on('error', (error) => {
            console.error('Request error:', error);
            reject({
                success: false,
                error: error.message,
                code: error.code
            });
        });

        req.on('timeout', () => {
            console.error('Request timeout');
            req.destroy();
            reject({
                success: false,
                error: 'Request timeout'
            });
        });

        req.end();
    });
}

async function testConnection() {
    console.log('Testing connection with native Node.js HTTP...');
    console.log('='.repeat(50));
    
    try {
        // 测试状态端点
        console.log('\n1. Testing /status endpoint...');
        const statusResult = await makeHttpRequest('/status');
        
        if (statusResult.success) {
            console.log('✅ Status request successful!');
            console.log('Response data:', JSON.stringify(statusResult.data, null, 2));
        } else {
            console.log('❌ Status request failed:', statusResult.error);
        }
        
        // 测试配置端点
        console.log('\n2. Testing /config endpoint...');
        const configResult = await makeHttpRequest('/config');
        
        if (configResult.success) {
            console.log('✅ Config request successful!');
            console.log('Response data:', JSON.stringify(configResult.data, null, 2));
        } else {
            console.log('❌ Config request failed:', configResult.error);
        }
        
        // 测试根端点
        console.log('\n3. Testing / endpoint...');
        const rootResult = await makeHttpRequest('/');
        
        if (rootResult.success) {
            console.log('✅ Root request successful!');
            console.log('Response data:', rootResult.data);
        } else {
            console.log('❌ Root request failed:', rootResult.error);
        }
        
    } catch (error) {
        console.error('Test failed with error:', error);
    }
}

if (require.main === module) {
    testConnection().catch(error => {
        console.error('Test suite failed:', error);
        process.exit(1);
    });
}

module.exports = { makeHttpRequest, testConnection };
