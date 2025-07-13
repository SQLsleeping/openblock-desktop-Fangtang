#!/usr/bin/env node

/**
 * 测试远程设备列表刷新功能
 * 验证配置远程烧录后，远程设备是否正确显示在设备列表中
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 测试远程设备列表刷新功能');
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
            console.log(`   版本: ${status.data.version || '未知'}`);
            return true;
        } else {
            console.log('⚠️  远程服务器响应异常:', status.message);
            return false;
        }
    } catch (error) {
        console.log('❌ 无法连接到远程服务器:', error.message);
        console.log('   请确保FangtangLink服务器正在运行');
        console.log('   服务器地址: http://192.168.0.109:5000');
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
    console.log('📋 远程设备列表刷新测试步骤:');
    console.log('=' .repeat(50));
    console.log('');
    
    console.log('🔧 第一步：检查初始状态');
    console.log('   1. 点击 "连接设备" 按钮');
    console.log('   2. 查看设备列表，此时应该没有远程设备');
    console.log('   3. 记录当前设备数量');
    console.log('');
    
    console.log('⚙️  第二步：配置远程烧录');
    console.log('   1. 点击菜单栏 "关于" → "Remote Flasher Settings"');
    console.log('   2. 输入服务器地址: http://192.168.0.109:5000');
    console.log('   3. 点击 "Test Connection" 测试连接');
    console.log('   4. 确认连接成功后，点击 "Save" 保存配置');
    console.log('   5. 观察保存成功的提示信息');
    console.log('');
    
    console.log('🔍 第三步：验证设备列表刷新');
    console.log('   1. 配置保存后，设备列表应该自动刷新');
    console.log('   2. 查看设备列表，应该出现 "Remote Arduino (FangtangLink)"');
    console.log('   3. 远程设备应该显示在设备列表的第二位（在"Unselect device"之后）');
    console.log('   4. 检查远程设备的图标和描述信息');
    console.log('');
    
    console.log('🧪 第四步：测试设备连接');
    console.log('   1. 选择 "Remote Arduino (FangtangLink)" 设备');
    console.log('   2. 点击连接按钮');
    console.log('   3. 观察连接过程和状态');
    console.log('   4. 检查连接成功后的界面变化');
    console.log('');
    
    console.log('🔄 第五步：测试配置禁用');
    console.log('   1. 再次打开 "Remote Flasher Settings"');
    console.log('   2. 取消勾选 "Enable Remote Flasher" 或清空服务器地址');
    console.log('   3. 保存配置');
    console.log('   4. 验证远程设备从设备列表中消失');
    console.log('');
    
    console.log('✅ 预期结果:');
    console.log('   - 配置远程烧录后，远程设备立即出现在设备列表中');
    console.log('   - 禁用远程烧录后，远程设备从设备列表中消失');
    console.log('   - 设备列表刷新无需重启应用程序');
    console.log('   - 远程设备可以正常连接和使用');
    console.log('');
    
    console.log('🐛 调试技巧:');
    console.log('   - 按 F12 或 Ctrl+Shift+I 打开开发者工具');
    console.log('   - 查看 Console 标签中的日志输出');
    console.log('   - 搜索 "Remote" 或 "device list" 相关日志');
    console.log('   - 查看 "Refreshing device list" 日志确认刷新被触发');
    console.log('   - 查看 "Remote Arduino device added" 日志确认设备被添加');
    console.log('');
    
    console.log('⚠️  注意事项:');
    console.log('   - 确保FangtangLink服务器正在运行');
    console.log('   - 确保网络连接正常');
    console.log('   - 如果测试失败，请查看控制台错误信息');
    console.log('   - 测试完成后按 Ctrl+C 停止应用程序');
    console.log('');
    console.log('🎯 开始测试！');
}

/**
 * 主函数
 */
async function main() {
    console.log('开始远程设备列表刷新功能测试...');
    console.log('');
    
    // 检查远程服务器
    const serverOnline = await checkRemoteServer();
    if (!serverOnline) {
        console.log('');
        console.log('❌ 远程服务器不可用，无法进行完整测试');
        console.log('请先启动FangtangLink服务器：');
        console.log('   cd doc/FangtangLink');
        console.log('   python -m src.remote_flasher.api_server');
        process.exit(1);
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
