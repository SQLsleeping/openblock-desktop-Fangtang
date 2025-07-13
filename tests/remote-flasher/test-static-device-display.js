#!/usr/bin/env node

/**
 * 测试静态远程设备显示功能
 * 验证Remote Arduino设备始终显示在设备列表中，无论配置状态如何
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 测试静态远程设备显示功能');
console.log('=' .repeat(60));

/**
 * 检查远程服务器状态
 */
async function checkRemoteServer() {
    console.log('🌐 检查远程服务器状态...');
    
    try {
        const RemoteFlasherClient = require('../../src/main/RemoteFlasherClient');
        const client = new RemoteFlasherClient('http://192.168.0.109:5000');
        
        const status = await client.getStatus();
        if (status.success) {
            console.log('✅ 远程服务器在线');
            console.log(`   状态: ${status.data.flasher_ready ? '就绪' : '未就绪'}`);
            return true;
        } else {
            console.log('⚠️  远程服务器响应异常:', status.message);
            return false;
        }
    } catch (error) {
        console.log('❌ 无法连接到远程服务器:', error.message);
        return false;
    }
}

/**
 * 启动应用程序并提供测试指导
 */
async function startAppAndGuideTest() {
    console.log('🚀 启动OpenBlock Desktop进行测试...');
    
    try {
        // 启动应用程序
        const appProcess = spawn('npm', ['start'], {
            cwd: path.resolve(__dirname, '../..'),
            stdio: 'pipe'
        });

        let appStarted = false;

        appProcess.stdout.on('data', (data) => {
            const output = data.toString();
            
            // 检查应用是否启动成功
            if (output.includes('webpack: Compiled successfully') || 
                output.includes('App is ready') ||
                output.includes('ready')) {
                if (!appStarted) {
                    appStarted = true;
                    console.log('✅ OpenBlock Desktop 启动成功');
                    showTestInstructions();
                }
            }
        });

        appProcess.stderr.on('data', (data) => {
            const output = data.toString();
            
            // 检查是否有错误
            if (output.includes('Error') || output.includes('error')) {
                console.log('⚠️  检测到错误输出:', output.trim());
            }
        });

        appProcess.on('close', (code) => {
            console.log(`\n📊 应用程序退出，退出码: ${code}`);
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
            }
        }, 30000); // 30秒超时

    } catch (error) {
        console.log('❌ 启动应用程序失败:', error.message);
        return false;
    }
}

/**
 * 显示测试指导
 */
function showTestInstructions() {
    console.log('');
    console.log('📋 静态远程设备显示测试步骤:');
    console.log('=' .repeat(50));
    console.log('');
    
    console.log('🔍 第一步：验证设备始终显示');
    console.log('   1. 点击 "连接设备" 按钮');
    console.log('   2. 查看设备列表，应该看到 "Remote Arduino (FangtangLink)" 设备');
    console.log('   3. 设备应该显示在Arduino Uno之后的位置');
    console.log('   4. 设备名称可能显示连接状态（Ready/Not Ready/Not Configured）');
    console.log('');
    
    console.log('⚙️  第二步：测试未配置状态下的连接');
    console.log('   1. 选择 "Remote Arduino (FangtangLink)" 设备');
    console.log('   2. 点击连接按钮');
    console.log('   3. 应该看到错误提示："Remote flasher is not configured"');
    console.log('   4. 提示应该指导用户去配置远程烧录');
    console.log('');
    
    console.log('🔧 第三步：配置远程烧录');
    console.log('   1. 点击菜单栏 "关于" → "Remote Flasher Settings"');
    console.log('   2. 输入服务器地址: http://192.168.0.109:5000');
    console.log('   3. 点击 "Test Connection" 测试连接');
    console.log('   4. 保存配置');
    console.log('');
    
    console.log('✅ 第四步：测试配置后的连接');
    console.log('   1. 再次选择 "Remote Arduino (FangtangLink)" 设备');
    console.log('   2. 点击连接按钮');
    console.log('   3. 应该能够成功连接到远程设备');
    console.log('   4. 检查连接状态和界面变化');
    console.log('');
    
    console.log('🧪 第五步：测试代码上传');
    console.log('   1. 创建一个简单的Arduino程序');
    console.log('   2. 点击 "上传到设备" 按钮');
    console.log('   3. 观察上传过程和结果');
    console.log('   4. 验证远程烧录功能正常工作');
    console.log('');
    
    console.log('🔄 第六步：测试配置禁用后的行为');
    console.log('   1. 再次打开 "Remote Flasher Settings"');
    console.log('   2. 禁用远程烧录或清空服务器地址');
    console.log('   3. 保存配置');
    console.log('   4. 验证设备仍然显示但连接时会提示未配置');
    console.log('');
    
    console.log('✅ 预期结果:');
    console.log('   - Remote Arduino设备始终显示在设备列表中');
    console.log('   - 未配置时连接会显示友好的错误提示');
    console.log('   - 配置后可以正常连接和使用');
    console.log('   - 设备名称可能显示当前状态');
    console.log('   - 无需重启应用程序即可使用');
    console.log('');
    
    console.log('🐛 调试技巧:');
    console.log('   - 按 F12 或 Ctrl+Shift+I 打开开发者工具');
    console.log('   - 查看 Console 标签中的日志输出');
    console.log('   - 搜索 "Remote" 或 "remote-flasher-device" 相关日志');
    console.log('   - 查看 "didDiscoverPeripheral" 日志确认设备被发现');
    console.log('   - 查看连接错误的详细信息');
    console.log('');
    
    console.log('⚠️  注意事项:');
    console.log('   - 设备应该始终显示，无论服务器是否在线');
    console.log('   - 连接错误应该提供清晰的指导信息');
    console.log('   - 配置更改后立即生效，无需重启');
    console.log('   - 测试完成后按 Ctrl+C 停止应用程序');
    console.log('');
    console.log('🎯 开始测试！');
}

/**
 * 主函数
 */
async function main() {
    console.log('开始静态远程设备显示功能测试...');
    console.log('');
    
    // 检查远程服务器（可选）
    const serverOnline = await checkRemoteServer();
    if (serverOnline) {
        console.log('✅ 远程服务器在线，可以进行完整测试');
    } else {
        console.log('⚠️  远程服务器离线，但仍可测试设备显示功能');
    }
    
    console.log('');
    
    // 启动应用程序并开始测试
    await startAppAndGuideTest();
}

// 运行测试
if (require.main === module) {
    main().catch(error => {
        console.error('测试失败:', error);
        process.exit(1);
    });
}

module.exports = {
    checkRemoteServer,
    startAppAndGuideTest,
    showTestInstructions
};
