#!/usr/bin/env node

/**
 * 调试网络连接问题
 */

const net = require('net');
const http = require('http');

const TARGET_HOST = '192.168.0.109';
const TARGET_PORT = 5000;

console.log('Network Connection Debug Tool');
console.log('============================');
console.log(`Target: ${TARGET_HOST}:${TARGET_PORT}`);
console.log('');

// 测试1: TCP连接
function testTcpConnection() {
    return new Promise((resolve) => {
        console.log('1. Testing TCP connection...');
        
        const socket = new net.Socket();
        let connected = false;
        
        socket.setTimeout(5000);
        
        socket.on('connect', () => {
            console.log('✅ TCP connection successful!');
            connected = true;
            socket.destroy();
            resolve(true);
        });
        
        socket.on('error', (error) => {
            console.log('❌ TCP connection failed:', error.message);
            console.log('   Error code:', error.code);
            console.log('   Error errno:', error.errno);
            console.log('   Syscall:', error.syscall);
            resolve(false);
        });
        
        socket.on('timeout', () => {
            console.log('❌ TCP connection timeout');
            socket.destroy();
            resolve(false);
        });
        
        try {
            socket.connect(TARGET_PORT, TARGET_HOST);
        } catch (error) {
            console.log('❌ TCP connect exception:', error.message);
            resolve(false);
        }
    });
}

// 测试2: HTTP请求（简化版）
function testHttpRequest() {
    return new Promise((resolve) => {
        console.log('\n2. Testing HTTP request...');
        
        const options = {
            hostname: TARGET_HOST,
            port: TARGET_PORT,
            path: '/status',
            method: 'GET',
            timeout: 5000,
            headers: {
                'User-Agent': 'Debug-Tool/1.0'
            }
        };
        
        console.log('Request options:', JSON.stringify(options, null, 2));
        
        const req = http.request(options, (res) => {
            console.log('✅ HTTP request successful!');
            console.log('   Status code:', res.statusCode);
            console.log('   Headers:', res.headers);
            
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                console.log('   Response data:', data);
                resolve(true);
            });
        });
        
        req.on('error', (error) => {
            console.log('❌ HTTP request failed:', error.message);
            console.log('   Error code:', error.code);
            console.log('   Error errno:', error.errno);
            console.log('   Syscall:', error.syscall);
            console.log('   Address:', error.address);
            console.log('   Port:', error.port);
            resolve(false);
        });
        
        req.on('timeout', () => {
            console.log('❌ HTTP request timeout');
            req.destroy();
            resolve(false);
        });
        
        req.end();
    });
}

// 测试3: 检查网络接口
function checkNetworkInterfaces() {
    console.log('\n3. Checking network interfaces...');
    
    const os = require('os');
    const interfaces = os.networkInterfaces();
    
    for (const [name, addrs] of Object.entries(interfaces)) {
        console.log(`Interface: ${name}`);
        for (const addr of addrs) {
            if (addr.family === 'IPv4' && !addr.internal) {
                console.log(`  IPv4: ${addr.address} (${addr.netmask})`);
                
                // 检查是否在同一网段
                const targetNetwork = '192.168.0';
                const localNetwork = addr.address.substring(0, addr.address.lastIndexOf('.'));
                
                if (localNetwork === targetNetwork) {
                    console.log(`  ✅ Same network segment as target`);
                } else {
                    console.log(`  ⚠️  Different network segment (local: ${localNetwork}, target: ${targetNetwork})`);
                }
            }
        }
    }
}

// 测试4: DNS解析
function testDnsResolution() {
    return new Promise((resolve) => {
        console.log('\n4. Testing DNS resolution...');
        
        const dns = require('dns');
        
        dns.lookup(TARGET_HOST, (err, address, family) => {
            if (err) {
                console.log('❌ DNS resolution failed:', err.message);
                resolve(false);
            } else {
                console.log('✅ DNS resolution successful');
                console.log(`   Resolved address: ${address}`);
                console.log(`   Address family: IPv${family}`);
                resolve(true);
            }
        });
    });
}

// 运行所有测试
async function runDebugTests() {
    checkNetworkInterfaces();
    
    const dnsResult = await testDnsResolution();
    const tcpResult = await testTcpConnection();
    const httpResult = await testHttpRequest();
    
    console.log('\n============================');
    console.log('Debug Results Summary:');
    console.log(`DNS Resolution: ${dnsResult ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`TCP Connection: ${tcpResult ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`HTTP Request: ${httpResult ? '✅ PASS' : '❌ FAIL'}`);
    
    if (tcpResult && httpResult) {
        console.log('\n🎉 All network tests passed! The issue might be in the application layer.');
    } else if (tcpResult && !httpResult) {
        console.log('\n⚠️  TCP works but HTTP fails. Check HTTP server configuration.');
    } else if (!tcpResult) {
        console.log('\n❌ TCP connection fails. Check network connectivity and firewall.');
    }
    
    console.log('\nTroubleshooting suggestions:');
    console.log('1. Verify the server is running: curl http://192.168.0.109:5000/status');
    console.log('2. Check firewall settings on both machines');
    console.log('3. Try connecting from the same machine as the server');
    console.log('4. Check if there are any VPN or proxy settings interfering');
}

if (require.main === module) {
    runDebugTests().catch(error => {
        console.error('Debug tests failed:', error);
        process.exit(1);
    });
}

module.exports = {
    runDebugTests,
    testTcpConnection,
    testHttpRequest
};
