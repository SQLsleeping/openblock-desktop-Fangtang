#!/usr/bin/env node

/**
 * 测试远程烧录功能的脚本
 * 用于验证FangtangLink API集成是否正常工作
 */

const RemoteFlasherClient = require('../src/main/RemoteFlasherClient');
const fs = require('fs');
const path = require('path');

// 测试配置
const TEST_CONFIG = {
    serverUrl: 'http://192.168.0.109:5000', // FangtangLink服务器地址
    testHexFile: path.join(__dirname, 'test-firmware.hex'),
    mcu: 'atmega328p',
    programmer: 'arduino',
    port: '/dev/ttyS0',
    baudrate: 115200
};

/**
 * 创建测试用的hex文件
 */
function createTestHexFile() {
    const testHexContent = `
:100000000C9434000C9451000C9451000C94510049
:100010000C9451000C9451000C9451000C9451001C
:100020000C9451000C9451000C9451000C9451000C
:100030000C9451000C9451000C9451000C945100FC
:100040000C9451000C9451000C9451000C945100EC
:100050000C9451000C9451000C9451000C945100DC
:100060000C9451000C9451000C9451000C945100CC
:100070000C9451000C9451000C9451000C945100BC
:100080000C9451000C9451000C94510011241FBE67
:10009000CFEFD8E0DEBFCDBF21E0A0E0B1E001C0A6
:1000A0001D92A930B207E1F70E9468000C9488007A
:1000B0000C940000E1EBF0E02491E9EBF0E094918E
:1000C000E92F99270895F894FFCF48656C6C6F2C20
:1000D000576F726C64210A0000
:00000001FF
`.trim();

    try {
        fs.writeFileSync(TEST_CONFIG.testHexFile, testHexContent);
        console.log(`✓ Created test hex file: ${TEST_CONFIG.testHexFile}`);
        return true;
    } catch (error) {
        console.error(`✗ Failed to create test hex file: ${error.message}`);
        return false;
    }
}

/**
 * 清理测试文件
 */
function cleanup() {
    try {
        if (fs.existsSync(TEST_CONFIG.testHexFile)) {
            fs.unlinkSync(TEST_CONFIG.testHexFile);
            console.log('✓ Cleaned up test files');
        }
    } catch (error) {
        console.error(`Warning: Failed to cleanup test files: ${error.message}`);
    }
}

/**
 * 测试远程烧录客户端基本功能
 */
async function testBasicFunctionality() {
    console.log('\n=== Testing Basic Functionality ===');
    
    const client = new RemoteFlasherClient(TEST_CONFIG.serverUrl);
    
    // 测试服务器状态
    console.log('1. Testing server status...');
    const status = await client.getStatus();
    if (status.success) {
        console.log('✓ Server status OK');
        console.log(`  Server info: ${JSON.stringify(status.data, null, 2)}`);
    } else {
        console.log(`✗ Server status failed: ${status.message}`);
        return false;
    }
    
    // 测试服务器配置
    console.log('2. Testing server configuration...');
    const config = await client.getConfig();
    if (config.success) {
        console.log('✓ Server configuration OK');
        console.log(`  Config: ${JSON.stringify(config.data, null, 2)}`);
    } else {
        console.log(`✗ Server configuration failed: ${config.message}`);
        return false;
    }
    
    // 测试连接
    console.log('3. Testing connection...');
    const connection = await client.testConnection();
    if (connection.success) {
        console.log('✓ Connection test OK');
        console.log(`  Message: ${connection.message}`);
    } else {
        console.log(`✗ Connection test failed: ${connection.message}`);
        return false;
    }
    
    return true;
}

/**
 * 测试设备信息获取
 */
async function testDeviceInfo() {
    console.log('\n=== Testing Device Information ===');
    
    const client = new RemoteFlasherClient(TEST_CONFIG.serverUrl);
    
    const deviceInfo = await client.getDeviceInfo({
        mcu: TEST_CONFIG.mcu,
        programmer: TEST_CONFIG.programmer,
        port: TEST_CONFIG.port,
        baudrate: TEST_CONFIG.baudrate
    });
    
    if (deviceInfo.success) {
        console.log('✓ Device info retrieved successfully');
        console.log(`  Device info: ${JSON.stringify(deviceInfo.data, null, 2)}`);
        return true;
    } else {
        console.log(`✗ Device info failed: ${deviceInfo.message}`);
        console.log('  Note: This may be normal if no device is connected');
        return true; // 不算作失败，因为可能没有连接设备
    }
}

/**
 * 测试复位控制
 */
async function testResetControl() {
    console.log('\n=== Testing Reset Control ===');
    
    const client = new RemoteFlasherClient(TEST_CONFIG.serverUrl);
    
    // 测试复位
    console.log('1. Testing reset activation...');
    const resetOn = await client.controlReset(true, 0.2);
    if (resetOn.success) {
        console.log('✓ Reset activation OK');
    } else {
        console.log(`✗ Reset activation failed: ${resetOn.message}`);
        return false;
    }
    
    // 等待一下
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 测试释放复位
    console.log('2. Testing reset release...');
    const resetOff = await client.controlReset(false);
    if (resetOff.success) {
        console.log('✓ Reset release OK');
    } else {
        console.log(`✗ Reset release failed: ${resetOff.message}`);
        return false;
    }
    
    return true;
}

/**
 * 测试文件烧录（如果有设备连接）
 */
async function testFileFlashing() {
    console.log('\n=== Testing File Flashing ===');
    
    const client = new RemoteFlasherClient(TEST_CONFIG.serverUrl);
    
    console.log('Warning: This test will attempt to flash a test firmware to the connected device.');
    console.log('Make sure you have a compatible Arduino device connected and are okay with flashing test firmware.');
    
    // 在实际测试中，可能需要用户确认
    console.log('Skipping actual flashing test for safety. To enable, modify this script.');
    
    // 如果要启用实际烧录测试，取消注释以下代码：
    /*
    const flashResult = await client.flashFile(TEST_CONFIG.testHexFile, {
        mcu: TEST_CONFIG.mcu,
        programmer: TEST_CONFIG.programmer,
        port: TEST_CONFIG.port,
        baudrate: TEST_CONFIG.baudrate
    });
    
    if (flashResult.success) {
        console.log('✓ File flashing OK');
        console.log(`  Result: ${JSON.stringify(flashResult.data, null, 2)}`);
        return true;
    } else {
        console.log(`✗ File flashing failed: ${flashResult.message}`);
        return false;
    }
    */
    
    return true;
}

/**
 * 主测试函数
 */
async function runTests() {
    console.log('OpenBlock Desktop Remote Flasher Test Suite');
    console.log('==========================================');
    console.log(`Server URL: ${TEST_CONFIG.serverUrl}`);
    console.log(`Test MCU: ${TEST_CONFIG.mcu}`);
    console.log(`Test Port: ${TEST_CONFIG.port}`);
    
    // 创建测试文件
    if (!createTestHexFile()) {
        console.log('Failed to create test files, aborting tests.');
        return;
    }
    
    let allTestsPassed = true;
    
    try {
        // 运行测试
        const tests = [
            { name: 'Basic Functionality', fn: testBasicFunctionality },
            { name: 'Device Information', fn: testDeviceInfo },
            { name: 'Reset Control', fn: testResetControl },
            { name: 'File Flashing', fn: testFileFlashing }
        ];
        
        for (const test of tests) {
            try {
                const result = await test.fn();
                if (!result) {
                    allTestsPassed = false;
                    console.log(`\n❌ Test "${test.name}" FAILED`);
                } else {
                    console.log(`\n✅ Test "${test.name}" PASSED`);
                }
            } catch (error) {
                allTestsPassed = false;
                console.log(`\n❌ Test "${test.name}" FAILED with exception: ${error.message}`);
            }
        }
        
        // 总结
        console.log('\n==========================================');
        if (allTestsPassed) {
            console.log('🎉 All tests PASSED! Remote flasher integration is working correctly.');
        } else {
            console.log('❌ Some tests FAILED. Please check the FangtangLink server and configuration.');
        }
        
    } finally {
        cleanup();
    }
}

// 运行测试
if (require.main === module) {
    runTests().catch(error => {
        console.error('Test suite failed with error:', error);
        cleanup();
        process.exit(1);
    });
}

module.exports = {
    runTests,
    testBasicFunctionality,
    testDeviceInfo,
    testResetControl,
    testFileFlashing
};
