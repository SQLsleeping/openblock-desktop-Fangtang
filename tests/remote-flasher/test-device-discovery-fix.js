#!/usr/bin/env node

/**
 * 测试远程设备发现修复
 * 验证在连接设备界面能够正确显示Remote Arduino选项
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 测试远程设备发现修复');
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
    console.log('📋 远程设备发现修复测试步骤:');
    console.log('=' .repeat(50));
    console.log('');
    
    console.log('🎯 测试目标:');
    console.log('   验证在连接设备界面能够自动显示Remote Arduino选项');
    console.log('');
    
    console.log('🔧 第一步：确保远程烧录已配置');
    console.log('   1. 点击菜单栏 "关于" → "Remote Flasher Settings"');
    console.log('   2. 输入服务器地址: http://192.168.0.109:5000');
    console.log('   3. 测试连接并保存配置');
    console.log('   4. 确保配置已启用');
    console.log('');
    
    console.log('📱 第二步：选择Arduino设备');
    console.log('   1. 在主界面点击 "连接设备" 按钮');
    console.log('   2. 在设备列表中选择 "Arduino Uno"');
    console.log('   3. 点击 "连接" 按钮');
    console.log('');
    
    console.log('🔍 第三步：验证远程设备显示');
    console.log('   1. 在连接设备界面，应该立即看到设备扫描');
    console.log('   2. 在设备列表顶部应该显示 "Remote Arduino (FangtangLink)"');
    console.log('   3. 远程设备应该标记为 "(Remote)"');
    console.log('   4. 不需要勾选"显示全部设备"就能看到远程选项');
    console.log('');
    
    console.log('🔄 第四步：测试刷新功能');
    console.log('   1. 点击 "Refresh" 按钮');
    console.log('   2. 验证远程设备仍然显示在列表中');
    console.log('   3. 远程设备应该始终在列表顶部');
    console.log('');
    
    console.log('✅ 第五步：测试连接功能');
    console.log('   1. 选择 "Remote Arduino (FangtangLink)" 并点击 "Connect"');
    console.log('   2. 观察连接过程和状态');
    console.log('   3. 验证连接成功');
    console.log('');
    
    console.log('🧪 第六步：测试其他设备类型');
    console.log('   1. 返回设备选择界面');
    console.log('   2. 选择非Arduino设备（如micro:bit）');
    console.log('   3. 验证远程Arduino选项不会显示');
    console.log('   4. 确保只在Arduino设备中显示远程选项');
    console.log('');
    
    console.log('✅ 预期结果:');
    console.log('   - Arduino设备连接界面立即显示Remote Arduino选项');
    console.log('   - 远程设备显示在列表顶部');
    console.log('   - 不需要勾选"显示全部设备"');
    console.log('   - 刷新后远程设备仍然存在');
    console.log('   - 非Arduino设备不显示远程选项');
    console.log('   - 可以成功连接到远程设备');
    console.log('');
    
    console.log('🐛 调试技巧:');
    console.log('   - 按 F12 或 Ctrl+Shift+I 打开开发者工具');
    console.log('   - 查看 Console 标签中的日志输出');
    console.log('   - 搜索 "Remote Arduino device added" 日志');
    console.log('   - 查看 "Failed to add remote Arduino device" 错误');
    console.log('   - 检查远程烧录配置是否正确加载');
    console.log('');
    
    console.log('⚠️  注意事项:');
    console.log('   - 确保远程烧录配置已启用');
    console.log('   - 确保FangtangLink服务器正在运行');
    console.log('   - 远程设备只在Arduino设备类型中显示');
    console.log('   - 如果不显示，检查控制台错误信息');
    console.log('   - 测试完成后按 Ctrl+C 停止应用程序');
    console.log('');
    
    console.log('🎯 关键验证点:');
    console.log('   1. ✅ 远程设备立即显示（无需等待扫描）');
    console.log('   2. ✅ 远程设备在列表顶部');
    console.log('   3. ✅ 远程设备标记为 "(Remote)"');
    console.log('   4. ✅ 刷新功能正常工作');
    console.log('   5. ✅ 只在Arduino设备中显示');
    console.log('   6. ✅ 连接功能正常工作');
    console.log('');
    
    console.log('🔧 如果远程设备不显示，请检查:');
    console.log('   1. 远程烧录配置是否已启用');
    console.log('   2. 服务器URL是否正确');
    console.log('   3. 是否选择了Arduino设备类型');
    console.log('   4. 控制台是否有错误信息');
    console.log('   5. 网络连接是否正常');
    console.log('');
    console.log('🎉 开始测试！');
}

/**
 * 主函数
 */
async function main() {
    console.log('开始远程设备发现修复功能测试...');
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
