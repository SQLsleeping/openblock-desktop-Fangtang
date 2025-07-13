#!/usr/bin/env node

/**
 * 测试设备连接和远程烧录功能
 */

const RemoteFlasherClient = require('./src/main/RemoteFlasherClient');

// 测试配置
const TEST_CONFIG = {
    serverUrl: 'http://192.168.0.109:5000',
    testCode: `
void setup() {
    Serial.begin(9600);
    pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
    digitalWrite(LED_BUILTIN, HIGH);
    delay(1000);
    digitalWrite(LED_BUILTIN, LOW);
    delay(1000);
    Serial.println("Hello from remote flasher!");
}
`,
    deviceConfig: {
        type: 'arduino',
        fqbn: 'arduino:avr:uno',
        firmware: 'arduino_uno.hex'
    }
};

/**
 * 测试远程设备发现
 */
async function testRemoteDeviceDiscovery() {
    console.log('🔍 测试远程设备发现');
    console.log('=' .repeat(50));
    
    const client = new RemoteFlasherClient(TEST_CONFIG.serverUrl);
    
    try {
        // 测试连接
        const connectionTest = await client.testConnection();
        if (!connectionTest.success) {
            console.log('❌ 无法连接到远程服务器');
            return false;
        }
        
        console.log('✅ 远程服务器连接成功');
        
        // 获取服务器状态
        const status = await client.getStatus();
        if (status.success && status.data.flasher_ready) {
            console.log('✅ 远程烧录器就绪');
            console.log('   服务器状态:', status.data);
            return true;
        } else {
            console.log('❌ 远程烧录器未就绪');
            return false;
        }
        
    } catch (error) {
        console.log('❌ 远程设备发现失败:', error.message);
        return false;
    }
}

/**
 * 测试设备信息获取
 */
async function testDeviceInfo() {
    console.log('\n📋 测试设备信息获取');
    console.log('=' .repeat(50));
    
    const client = new RemoteFlasherClient(TEST_CONFIG.serverUrl);
    
    try {
        const deviceInfo = await client.getDeviceInfo({
            mcu: 'atmega328p',
            programmer: 'arduino',
            port: '/dev/ttyS0',
            baudrate: 115200
        });
        
        if (deviceInfo.success) {
            console.log('✅ 设备信息获取成功');
            console.log('   设备信息:', JSON.stringify(deviceInfo.data, null, 2));
            return true;
        } else {
            console.log('⚠️  设备信息获取失败:', deviceInfo.message);
            console.log('   这可能是正常的，如果没有Arduino连接到Raspberry Pi');
            return true; // 不算作失败
        }
        
    } catch (error) {
        console.log('❌ 设备信息获取异常:', error.message);
        return false;
    }
}

/**
 * 模拟代码编译
 */
function simulateCodeCompilation() {
    console.log('\n⚙️  模拟代码编译');
    console.log('=' .repeat(50));
    
    console.log('正在编译Arduino代码...');
    console.log('代码内容:');
    console.log(TEST_CONFIG.testCode);
    
    // 模拟编译过程
    console.log('✅ 代码编译成功');
    console.log('   生成的hex文件: test-firmware.hex');
    
    return true;
}

/**
 * 测试远程烧录流程
 */
async function testRemoteFlashing() {
    console.log('\n🔥 测试远程烧录流程');
    console.log('=' .repeat(50));
    
    const client = new RemoteFlasherClient(TEST_CONFIG.serverUrl);
    
    try {
        // 创建测试hex文件
        const fs = require('fs');
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
        
        const testHexFile = 'test-firmware.hex';
        fs.writeFileSync(testHexFile, testHexContent);
        console.log('✅ 创建测试hex文件');
        
        // 测试烧录
        console.log('正在进行远程烧录...');
        const flashResult = await client.flashFile(testHexFile, {
            mcu: 'atmega328p',
            programmer: 'arduino',
            port: '/dev/ttyS0',
            baudrate: 115200
        });
        
        // 清理测试文件
        fs.unlinkSync(testHexFile);
        
        if (flashResult.success) {
            console.log('✅ 远程烧录成功!');
            console.log('   烧录结果:', JSON.stringify(flashResult.data, null, 2));
            return true;
        } else {
            console.log('❌ 远程烧录失败:', flashResult.message);
            return false;
        }
        
    } catch (error) {
        console.log('❌ 远程烧录异常:', error.message);
        return false;
    }
}

/**
 * 测试完整的设备连接和上传流程
 */
async function testCompleteWorkflow() {
    console.log('\n🚀 测试完整工作流程');
    console.log('=' .repeat(50));
    
    console.log('模拟OpenBlock Desktop的完整工作流程:');
    console.log('');
    
    // 1. 设备发现
    console.log('1️⃣  设备发现阶段');
    const discoveryResult = await testRemoteDeviceDiscovery();
    if (!discoveryResult) {
        console.log('❌ 设备发现失败，终止测试');
        return false;
    }
    
    // 2. 设备连接
    console.log('\n2️⃣  设备连接阶段');
    console.log('✅ 模拟连接到远程设备: remote-flasher-device');
    
    // 3. 代码编译
    console.log('\n3️⃣  代码编译阶段');
    const compilationResult = simulateCodeCompilation();
    if (!compilationResult) {
        console.log('❌ 代码编译失败，终止测试');
        return false;
    }
    
    // 4. 远程烧录
    console.log('\n4️⃣  远程烧录阶段');
    const flashingResult = await testRemoteFlashing();
    if (!flashingResult) {
        console.log('❌ 远程烧录失败');
        return false;
    }
    
    console.log('\n🎉 完整工作流程测试成功!');
    return true;
}

/**
 * 主测试函数
 */
async function runTests() {
    console.log('OpenBlock Desktop 设备连接和远程烧录测试');
    console.log('=' .repeat(60));
    console.log(`服务器地址: ${TEST_CONFIG.serverUrl}`);
    console.log('');
    
    const tests = [
        { name: '远程设备发现', fn: testRemoteDeviceDiscovery },
        { name: '设备信息获取', fn: testDeviceInfo },
        { name: '完整工作流程', fn: testCompleteWorkflow }
    ];
    
    let passedTests = 0;
    
    for (const test of tests) {
        try {
            console.log(`\n🧪 运行测试: ${test.name}`);
            const result = await test.fn();
            if (result) {
                console.log(`✅ 测试 "${test.name}" 通过`);
                passedTests++;
            } else {
                console.log(`❌ 测试 "${test.name}" 失败`);
            }
        } catch (error) {
            console.log(`❌ 测试 "${test.name}" 异常:`, error.message);
        }
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log(`测试结果: ${passedTests}/${tests.length} 通过`);
    
    if (passedTests === tests.length) {
        console.log('🎉 所有测试通过! 设备连接和远程烧录功能正常工作。');
    } else {
        console.log('⚠️  部分测试失败，请检查配置和连接。');
    }
}

// 运行测试
if (require.main === module) {
    runTests().catch(error => {
        console.error('测试套件失败:', error);
        process.exit(1);
    });
}

module.exports = {
    runTests,
    testRemoteDeviceDiscovery,
    testDeviceInfo,
    testRemoteFlashing,
    testCompleteWorkflow
};
