#!/usr/bin/env node

/**
 * 测试新的连接流程：
 * 1. 在设备列表中选择Arduino Uno
 * 2. 在连接设备界面选择Remote Arduino选项
 * 3. 上传时自动使用远程烧录
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 测试新的远程Arduino连接流程');
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
    console.log('📋 新连接流程测试步骤:');
    console.log('=' .repeat(50));
    console.log('');
    
    console.log('🎯 测试目标:');
    console.log('   验证用户可以选择Arduino Uno设备，然后在连接界面选择远程连接');
    console.log('');
    
    console.log('🔧 第一步：配置远程烧录（如果尚未配置）');
    console.log('   1. 点击菜单栏 "关于" → "Remote Flasher Settings"');
    console.log('   2. 输入服务器地址: http://192.168.0.109:5000');
    console.log('   3. 测试连接并保存配置');
    console.log('');
    
    console.log('📱 第二步：选择Arduino设备');
    console.log('   1. 在主界面点击 "连接设备" 按钮');
    console.log('   2. 在设备列表中选择 "Arduino Uno"（或其他Arduino设备）');
    console.log('   3. 点击 "连接" 按钮');
    console.log('');
    
    console.log('🔗 第三步：选择连接方式');
    console.log('   1. 在连接设备界面，应该看到设备扫描列表');
    console.log('   2. 在列表顶部应该有 "Remote Arduino (FangtangLink)" 选项');
    console.log('   3. 选择 "Remote Arduino (FangtangLink)" 并点击 "Connect"');
    console.log('   4. 观察连接过程和状态');
    console.log('');
    
    console.log('✅ 第四步：验证连接成功');
    console.log('   1. 连接成功后应该显示连接状态');
    console.log('   2. 界面应该显示已连接到远程设备');
    console.log('   3. 设备图标应该变为已连接状态');
    console.log('');
    
    console.log('🧪 第五步：测试代码上传');
    console.log('   1. 创建一个简单的Arduino程序（如Blink示例）');
    console.log('   2. 点击 "上传到设备" 按钮');
    console.log('   3. 观察上传过程，应该显示 "Using remote flasher for upload..."');
    console.log('   4. 验证远程烧录功能正常工作');
    console.log('');
    
    console.log('🔄 第六步：测试断开连接');
    console.log('   1. 点击设备连接按钮断开连接');
    console.log('   2. 验证可以重新连接');
    console.log('   3. 测试本地设备连接是否仍然正常工作');
    console.log('');
    
    console.log('✅ 预期结果:');
    console.log('   - Arduino设备列表正常显示');
    console.log('   - 连接界面显示Remote Arduino选项');
    console.log('   - 可以成功连接到远程设备');
    console.log('   - 上传时自动使用远程烧录');
    console.log('   - 本地设备连接不受影响');
    console.log('');
    
    console.log('🐛 调试技巧:');
    console.log('   - 按 F12 或 Ctrl+Shift+I 打开开发者工具');
    console.log('   - 查看 Console 标签中的日志输出');
    console.log('   - 搜索 "Remote Arduino" 或 "remote-arduino" 相关日志');
    console.log('   - 查看 "Using remote flasher" 日志确认远程烧录被使用');
    console.log('   - 检查连接错误的详细信息');
    console.log('');
    
    console.log('⚠️  注意事项:');
    console.log('   - 确保FangtangLink服务器正在运行');
    console.log('   - 确保远程烧录配置已正确设置');
    console.log('   - Remote Arduino选项只在Arduino设备的连接界面显示');
    console.log('   - 如果连接失败，检查配置和网络连接');
    console.log('   - 测试完成后按 Ctrl+C 停止应用程序');
    console.log('');
    
    console.log('🎯 关键验证点:');
    console.log('   1. ✅ Arduino设备可以正常选择');
    console.log('   2. ✅ 连接界面显示Remote Arduino选项');
    console.log('   3. ✅ 远程连接配置检查正常工作');
    console.log('   4. ✅ 上传时自动切换到远程烧录');
    console.log('   5. ✅ 本地设备连接功能不受影响');
    console.log('');
    console.log('🎉 开始测试！');
}

/**
 * 主函数
 */
async function main() {
    console.log('开始新连接流程功能测试...');
    console.log('');
    
    // 检查远程服务器（可选）
    const serverOnline = await checkRemoteServer();
    if (serverOnline) {
        console.log('✅ 远程服务器在线，可以进行完整测试');
    } else {
        console.log('⚠️  远程服务器离线，但仍可测试界面功能');
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
