#!/usr/bin/env node

/**
 * 测试远程设备在UI中的显示和连接功能
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 测试远程设备UI集成');
console.log('=' .repeat(60));

/**
 * 启动OpenBlock Desktop并测试远程设备功能
 */
async function testRemoteDeviceUI() {
    console.log('1️⃣  启动OpenBlock Desktop...');
    
    try {
        // 启动应用程序
        const appProcess = spawn('npm', ['start'], {
            cwd: process.cwd(),
            stdio: 'pipe'
        });

        let appOutput = '';
        let appStarted = false;

        appProcess.stdout.on('data', (data) => {
            const output = data.toString();
            appOutput += output;
            
            // 检查应用是否启动成功
            if (output.includes('webpack: Compiled successfully') || 
                output.includes('App is ready') ||
                output.includes('ready')) {
                appStarted = true;
                console.log('✅ OpenBlock Desktop 启动成功');
                console.log('');
                console.log('📋 测试步骤:');
                console.log('');
                console.log('1. 配置远程烧录:');
                console.log('   - 点击菜单栏 "关于" → "Remote Flasher Settings"');
                console.log('   - 输入服务器地址: http://192.168.0.109:5000');
                console.log('   - 点击 "Test Connection" 测试连接');
                console.log('   - 保存配置');
                console.log('');
                console.log('2. 检查设备列表:');
                console.log('   - 点击 "连接设备" 按钮');
                console.log('   - 查看是否显示 "Remote Arduino (FangtangLink)" 设备');
                console.log('   - 如果没有显示，请检查远程服务器是否运行');
                console.log('');
                console.log('3. 连接远程设备:');
                console.log('   - 选择 "Remote Arduino (FangtangLink)" 设备');
                console.log('   - 点击连接按钮');
                console.log('   - 检查连接状态');
                console.log('');
                console.log('4. 测试代码上传:');
                console.log('   - 创建一个简单的Arduino程序');
                console.log('   - 点击 "上传到设备" 按钮');
                console.log('   - 观察上传过程和结果');
                console.log('');
                console.log('⚠️  注意事项:');
                console.log('   - 确保FangtangLink服务器正在运行');
                console.log('   - 确保网络连接正常');
                console.log('   - 如果远程设备不显示，请重启应用');
                console.log('');
                console.log('🔍 调试信息:');
                console.log('   - 打开开发者工具 (Ctrl+Shift+I / Cmd+Option+I)');
                console.log('   - 查看控制台输出');
                console.log('   - 搜索 "Remote" 相关日志');
                console.log('');
                console.log('按 Ctrl+C 停止应用程序');
            }
        });

        appProcess.stderr.on('data', (data) => {
            const output = data.toString();
            appOutput += output;
            
            // 检查是否有错误
            if (output.includes('Error') || output.includes('error')) {
                console.log('⚠️  检测到错误输出:', output.trim());
            }
        });

        appProcess.on('close', (code) => {
            console.log(`\n📊 应用程序退出，退出码: ${code}`);
            
            if (code !== 0) {
                console.log('❌ 应用程序异常退出');
                console.log('输出日志:');
                console.log(appOutput);
            } else {
                console.log('✅ 应用程序正常退出');
            }
        });

        // 等待用户手动停止
        process.on('SIGINT', () => {
            console.log('\n🛑 收到停止信号，正在关闭应用程序...');
            appProcess.kill('SIGTERM');
            
            setTimeout(() => {
                console.log('强制关闭应用程序');
                appProcess.kill('SIGKILL');
                process.exit(0);
            }, 5000);
        });

        // 超时检查
        setTimeout(() => {
            if (!appStarted) {
                console.log('⏰ 应用启动超时，可能存在问题');
                console.log('输出日志:');
                console.log(appOutput);
            }
        }, 30000); // 30秒超时

    } catch (error) {
        console.log('❌ 启动应用程序失败:', error.message);
        return false;
    }
}

/**
 * 检查环境和依赖
 */
function checkEnvironment() {
    console.log('🔧 检查环境...');
    
    // 检查package.json
    try {
        const packageJson = require('./package.json');
        console.log(`✅ 项目: ${packageJson.name} v${packageJson.version}`);
    } catch (error) {
        console.log('❌ 无法读取package.json');
        return false;
    }
    
    // 检查node_modules
    const fs = require('fs');
    if (!fs.existsSync('./node_modules')) {
        console.log('❌ node_modules不存在，请运行 npm install');
        return false;
    }
    
    console.log('✅ 环境检查通过');
    return true;
}

/**
 * 显示远程服务器状态
 */
async function checkRemoteServer() {
    console.log('🌐 检查远程服务器状态...');
    
    try {
        const RemoteFlasherClient = require('./src/main/RemoteFlasherClient');
        const client = new RemoteFlasherClient('http://192.168.0.109:5000');
        
        const status = await client.getStatus();
        if (status.success) {
            console.log('✅ 远程服务器在线');
            console.log(`   状态: ${status.data.flasher_ready ? '就绪' : '未就绪'}`);
            console.log(`   版本: ${status.data.version || '未知'}`);
        } else {
            console.log('⚠️  远程服务器响应异常:', status.message);
        }
    } catch (error) {
        console.log('❌ 无法连接到远程服务器:', error.message);
        console.log('   请确保FangtangLink服务器正在运行');
        console.log('   服务器地址: http://192.168.0.109:5000');
    }
}

/**
 * 主函数
 */
async function main() {
    console.log('开始测试远程设备UI集成功能...');
    console.log('');
    
    // 检查环境
    if (!checkEnvironment()) {
        process.exit(1);
    }
    
    console.log('');
    
    // 检查远程服务器
    await checkRemoteServer();
    
    console.log('');
    
    // 启动UI测试
    await testRemoteDeviceUI();
}

// 运行测试
if (require.main === module) {
    main().catch(error => {
        console.error('测试失败:', error);
        process.exit(1);
    });
}

module.exports = {
    testRemoteDeviceUI,
    checkEnvironment,
    checkRemoteServer
};
