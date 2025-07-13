#!/usr/bin/env node

/**
 * 简单的HTTP连接测试
 */

const http = require('http');
const https = require('https');
const axios = require('axios');

const SERVER_URL = 'http://192.168.0.109:5000';

console.log('Testing HTTP connection to:', SERVER_URL);

// 测试1: 使用原生Node.js http模块
function testWithNodeHttp() {
    return new Promise((resolve, reject) => {
        console.log('\n1. Testing with Node.js http module...');
        
        const url = new URL(SERVER_URL + '/status');
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: 'GET',
            timeout: 5000
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                console.log('✅ Node.js http success!');
                console.log('Status:', res.statusCode);
                console.log('Data:', data);
                resolve(true);
            });
        });

        req.on('error', (error) => {
            console.log('❌ Node.js http failed:', error.message);
            resolve(false);
        });

        req.on('timeout', () => {
            console.log('❌ Node.js http timeout');
            req.destroy();
            resolve(false);
        });

        req.end();
    });
}

// 测试2: 使用axios (默认配置)
async function testWithAxiosDefault() {
    console.log('\n2. Testing with axios (default config)...');
    
    try {
        const response = await axios.get(SERVER_URL + '/status', {
            timeout: 5000
        });
        console.log('✅ Axios default success!');
        console.log('Status:', response.status);
        console.log('Data:', response.data);
        return true;
    } catch (error) {
        console.log('❌ Axios default failed:', error.message);
        if (error.response) {
            console.log('Response status:', error.response.status);
        }
        return false;
    }
}

// 测试3: 使用axios (自定义配置)
async function testWithAxiosCustom() {
    console.log('\n3. Testing with axios (custom config)...');
    
    const customAxios = axios.create({
        timeout: 10000,
        headers: {
            'User-Agent': 'OpenBlock-Desktop-Test/1.0'
        },
        // 禁用代理
        proxy: false,
        // 设置更宽松的网络选项
        httpAgent: new http.Agent({
            keepAlive: false,
            timeout: 10000
        })
    });
    
    try {
        const response = await customAxios.get(SERVER_URL + '/status');
        console.log('✅ Axios custom success!');
        console.log('Status:', response.status);
        console.log('Data:', response.data);
        return true;
    } catch (error) {
        console.log('❌ Axios custom failed:', error.message);
        if (error.response) {
            console.log('Response status:', error.response.status);
        }
        return false;
    }
}

// 测试4: 检查网络配置
function checkNetworkConfig() {
    console.log('\n4. Checking network configuration...');
    
    console.log('Environment variables:');
    console.log('HTTP_PROXY:', process.env.HTTP_PROXY || 'not set');
    console.log('HTTPS_PROXY:', process.env.HTTPS_PROXY || 'not set');
    console.log('NO_PROXY:', process.env.NO_PROXY || 'not set');
    
    console.log('\nNode.js version:', process.version);
    console.log('Platform:', process.platform);
    console.log('Architecture:', process.arch);
}

// 运行所有测试
async function runAllTests() {
    console.log('HTTP Connection Test Suite');
    console.log('==========================');
    
    checkNetworkConfig();
    
    const results = [];
    results.push(await testWithNodeHttp());
    results.push(await testWithAxiosDefault());
    results.push(await testWithAxiosCustom());
    
    console.log('\n==========================');
    console.log('Test Results:');
    console.log('Node.js http:', results[0] ? '✅ PASS' : '❌ FAIL');
    console.log('Axios default:', results[1] ? '✅ PASS' : '❌ FAIL');
    console.log('Axios custom:', results[2] ? '✅ PASS' : '❌ FAIL');
    
    const passCount = results.filter(r => r).length;
    console.log(`\nOverall: ${passCount}/3 tests passed`);
    
    if (passCount > 0) {
        console.log('\n✅ At least one method works! The server is reachable.');
    } else {
        console.log('\n❌ All methods failed. Check network connectivity.');
    }
}

if (require.main === module) {
    runAllTests().catch(error => {
        console.error('Test suite failed:', error);
        process.exit(1);
    });
}

module.exports = {
    runAllTests,
    testWithNodeHttp,
    testWithAxiosDefault,
    testWithAxiosCustom
};
