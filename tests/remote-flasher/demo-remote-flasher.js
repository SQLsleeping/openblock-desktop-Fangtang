#!/usr/bin/env node

/**
 * OpenBlock Desktop 远程烧录功能演示
 * 
 * 这个脚本演示了如何使用新添加的远程烧录功能
 * 包括配置、测试连接和模拟烧录过程
 */

const RemoteFlasherClient = require('./src/main/RemoteFlasherClient');
const fs = require('fs');
const path = require('path');

// 演示配置
const DEMO_CONFIG = {
    // 修改这个地址为你的Raspberry Pi IP
    serverUrl: 'http://192.168.0.109:5000',
    
    // Arduino配置
    mcu: 'atmega328p',
    programmer: 'arduino', 
    port: '/dev/ttyS0',
    baudrate: 115200
};

/**
 * 演示基本连接和配置
 */
async function demoBasicConnection() {
    console.log('🔗 演示1: 基本连接和配置');
    console.log('=' .repeat(50));
    
    const client = new RemoteFlasherClient(DEMO_CONFIG.serverUrl);
    
    console.log(`正在连接到远程烧录服务器: ${DEMO_CONFIG.serverUrl}`);
    
    // 测试连接
    const connectionTest = await client.testConnection();
    
    if (connectionTest.success) {
        console.log('✅ 连接成功!');
        console.log(`服务器信息: ${connectionTest.message}`);
        
        // 获取服务器配置
        const config = await client.getConfig();
        if (config.success) {
            console.log('\n📋 服务器配置:');
            console.log(JSON.stringify(config.data, null, 2));
        }
        
        return true;
    } else {
        console.log('❌ 连接失败!');
        console.log(`错误信息: ${connectionTest.message}`);
        console.log('\n💡 请确保:');
        console.log('   1. Raspberry Pi上的FangtangLink服务器正在运行');
        console.log('   2. IP地址配置正确');
        console.log('   3. 网络连接正常');
        return false;
    }
}

/**
 * 演示设备信息获取
 */
async function demoDeviceInfo() {
    console.log('\n🔍 演示2: 获取设备信息');
    console.log('=' .repeat(50));
    
    const client = new RemoteFlasherClient(DEMO_CONFIG.serverUrl);
    
    console.log('正在获取连接的Arduino设备信息...');
    
    const deviceInfo = await client.getDeviceInfo({
        mcu: DEMO_CONFIG.mcu,
        programmer: DEMO_CONFIG.programmer,
        port: DEMO_CONFIG.port,
        baudrate: DEMO_CONFIG.baudrate
    });
    
    if (deviceInfo.success) {
        console.log('✅ 设备信息获取成功!');
        console.log('设备详情:');
        console.log(JSON.stringify(deviceInfo.data, null, 2));
    } else {
        console.log('⚠️  设备信息获取失败');
        console.log(`原因: ${deviceInfo.message}`);
        console.log('\n💡 这可能是正常的，如果:');
        console.log('   1. 没有Arduino设备连接到Raspberry Pi');
        console.log('   2. 设备正在被其他程序使用');
        console.log('   3. 串口配置不正确');
    }
}

/**
 * 演示复位控制
 */
async function demoResetControl() {
    console.log('\n🔄 演示3: 设备复位控制');
    console.log('=' .repeat(50));
    
    const client = new RemoteFlasherClient(DEMO_CONFIG.serverUrl);
    
    console.log('正在测试Arduino设备复位控制...');
    
    // 激活复位
    console.log('1. 激活复位信号...');
    const resetOn = await client.controlReset(true, 0.2);
    
    if (resetOn.success) {
        console.log('✅ 复位信号激活成功');
    } else {
        console.log(`❌ 复位信号激活失败: ${resetOn.message}`);
        return;
    }
    
    // 等待一下
    console.log('2. 等待复位生效...');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 释放复位
    console.log('3. 释放复位信号...');
    const resetOff = await client.controlReset(false);
    
    if (resetOff.success) {
        console.log('✅ 复位信号释放成功');
        console.log('🎉 设备复位控制演示完成!');
    } else {
        console.log(`❌ 复位信号释放失败: ${resetOff.message}`);
    }
}

/**
 * 演示配置管理
 */
function demoConfigManagement() {
    console.log('\n⚙️  演示4: 配置管理');
    console.log('=' .repeat(50));
    
    console.log('在OpenBlock Desktop中配置远程烧录:');
    console.log('');
    console.log('1. 启动OpenBlock Desktop');
    console.log('2. 点击菜单栏 "关于" -> "Remote Flasher Settings"');
    console.log('3. 选择 "Configure"');
    console.log(`4. 输入服务器地址: ${DEMO_CONFIG.serverUrl}`);
    console.log('5. 点击测试连接验证');
    console.log('6. 保存配置');
    console.log('');
    console.log('配置完成后，所有Arduino项目的上传操作将自动使用远程烧录!');
}

/**
 * 演示工作流程
 */
function demoWorkflow() {
    console.log('\n🚀 演示5: 完整工作流程');
    console.log('=' .repeat(50));
    
    console.log('使用远程烧录的完整流程:');
    console.log('');
    console.log('📝 1. 在OpenBlock Desktop中创建Arduino项目');
    console.log('   - 使用图形化编程界面编写代码');
    console.log('   - 或者导入现有的Arduino项目');
    console.log('');
    console.log('🔧 2. 配置远程烧录 (一次性设置)');
    console.log('   - 设置Raspberry Pi的IP地址');
    console.log('   - 测试连接确保通信正常');
    console.log('');
    console.log('🔌 3. 连接设备');
    console.log('   - 选择远程设备连接');
    console.log('   - 系统会自动检测远程Arduino');
    console.log('');
    console.log('⬆️  4. 上传代码');
    console.log('   - 点击上传按钮');
    console.log('   - 代码在本地编译');
    console.log('   - hex文件传输到Raspberry Pi');
    console.log('   - 远程烧录到Arduino');
    console.log('   - 实时查看烧录进度');
    console.log('');
    console.log('✅ 5. 完成');
    console.log('   - Arduino自动重启运行新程序');
    console.log('   - 可以立即开始调试和测试');
}

/**
 * 主演示函数
 */
async function runDemo() {
    console.log('🎯 OpenBlock Desktop 远程烧录功能演示');
    console.log('=' .repeat(60));
    console.log('');
    console.log('本演示将展示如何使用新添加的远程烧录功能');
    console.log('通过FangtangLink API连接到Raspberry Pi进行远程Arduino烧录');
    console.log('');
    console.log(`配置的服务器地址: ${DEMO_CONFIG.serverUrl}`);
    console.log('');
    
    // 检查连接
    const connected = await demoBasicConnection();
    
    if (connected) {
        // 如果连接成功，运行其他演示
        await demoDeviceInfo();
        await demoResetControl();
    } else {
        console.log('\n⚠️  由于无法连接到服务器，跳过需要连接的演示');
    }
    
    // 显示配置和工作流程信息
    demoConfigManagement();
    demoWorkflow();
    
    console.log('\n🎉 演示完成!');
    console.log('');
    console.log('📚 更多信息请参考:');
    console.log('   - REMOTE_FLASHER_README.md - 详细使用说明');
    console.log('   - doc/FangtangLink/README.md - FangtangLink API文档');
    console.log('');
    console.log('🛠️  故障排除:');
    console.log('   - 确保FangtangLink服务器在Raspberry Pi上运行');
    console.log('   - 检查网络连接和IP地址配置');
    console.log('   - 验证Arduino设备正确连接到Raspberry Pi');
}

// 运行演示
if (require.main === module) {
    runDemo().catch(error => {
        console.error('\n❌ 演示过程中发生错误:', error.message);
        process.exit(1);
    });
}

module.exports = {
    runDemo,
    demoBasicConnection,
    demoDeviceInfo,
    demoResetControl,
    DEMO_CONFIG
};
