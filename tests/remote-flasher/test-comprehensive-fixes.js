#!/usr/bin/env node

/**
 * 综合测试所有修复：
 * 1. 验证不会显示重复的远程设备
 * 2. 验证连接成功后状态正确更新
 * 3. 验证VM连接事件正确触发
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 综合测试所有修复');
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
    console.log('📋 综合修复测试步骤:');
    console.log('=' .repeat(50));
    console.log('');
    
    console.log('🎯 测试目标:');
    console.log('   1. 验证不会显示重复的远程设备');
    console.log('   2. 验证连接成功后状态正确更新');
    console.log('   3. 验证VM连接事件正确触发');
    console.log('   4. 验证编辑器状态同步');
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
    
    console.log('🔍 第三步：验证设备列表（修复1 - 重复设备）');
    console.log('   ✅ 应该只看到一个 "Remote Arduino (FangtangLink)"');
    console.log('   ✅ 不应该有重复的远程设备');
    console.log('   ✅ 远程设备应该在列表顶部');
    console.log('   ✅ 打开开发者工具，查看控制台应该只有一条"Remote Arduino device added"日志');
    console.log('');
    
    console.log('🔄 第四步：测试刷新功能');
    console.log('   1. 点击 "Refresh" 按钮');
    console.log('   ✅ 验证仍然只有一个远程设备');
    console.log('   ✅ 远程设备应该保持在列表顶部');
    console.log('   ✅ 控制台不应该出现重复添加的日志');
    console.log('');
    
    console.log('✅ 第五步：测试连接状态（修复2 - 连接状态）');
    console.log('   1. 选择 "Remote Arduino (FangtangLink)" 并点击 "Connect"');
    console.log('   2. 观察连接过程：');
    console.log('      ✅ 应该显示 "Connecting..."');
    console.log('      ✅ 2秒内应该变为 "Connected"');
    console.log('      ✅ 控制台应该显示连接相关日志');
    console.log('   3. 点击 "Go to Editor" 返回编辑器');
    console.log('');
    
    console.log('🎯 第六步：验证编辑器状态（关键测试）');
    console.log('   1. 返回编辑器后，检查设备连接状态：');
    console.log('      ✅ 设备连接状态应该显示为已连接');
    console.log('      ✅ 设备图标应该变为绿色或已连接状态');
    console.log('      ✅ 应该显示 "Remote Arduino" 或类似的连接信息');
    console.log('      ✅ "上传到设备" 按钮应该可用（不是灰色）');
    console.log('');
    
    console.log('🧪 第七步：测试代码上传');
    console.log('   1. 创建一个简单的Arduino程序（如Blink示例）');
    console.log('   2. 点击 "上传到设备" 按钮');
    console.log('   3. 观察上传过程：');
    console.log('      ✅ 应该显示远程烧录信息');
    console.log('      ✅ 应该显示 "Using remote flasher for upload..."');
    console.log('      ✅ 验证上传成功');
    console.log('');
    
    console.log('🔌 第八步：测试断开连接');
    console.log('   1. 点击设备连接按钮断开连接');
    console.log('   2. 验证状态变为未连接');
    console.log('   3. 测试重新连接功能');
    console.log('');
    
    console.log('🔄 第九步：重复测试');
    console.log('   1. 重新连接远程设备');
    console.log('   2. 验证所有功能仍然正常');
    console.log('   3. 确保没有重复设备出现');
    console.log('');
    
    console.log('✅ 预期结果:');
    console.log('   - 只显示一个远程Arduino设备（无重复）');
    console.log('   - 连接成功后编辑器显示已连接状态');
    console.log('   - 设备图标和状态正确更新');
    console.log('   - 上传功能正常工作');
    console.log('   - 断开连接功能正常');
    console.log('   - 重复连接测试正常');
    console.log('');
    
    console.log('🐛 调试技巧:');
    console.log('   - 按 F12 或 Ctrl+Shift+I 打开开发者工具');
    console.log('   - 查看 Console 标签中的日志输出');
    console.log('   - 搜索关键日志：');
    console.log('     * "Remote Arduino device added"');
    console.log('     * "Remote Arduino device already exists"');
    console.log('     * "connected" 事件相关日志');
    console.log('     * "PERIPHERAL_CONNECTED" 事件');
    console.log('   - 检查设备连接状态的更新');
    console.log('');
    
    console.log('⚠️  注意事项:');
    console.log('   - 确保远程烧录配置已启用');
    console.log('   - 确保FangtangLink服务器正在运行');
    console.log('   - 如果仍有重复设备，请重启应用程序');
    console.log('   - 如果连接状态不更新，检查控制台错误');
    console.log('   - 测试完成后按 Ctrl+C 停止应用程序');
    console.log('');
    
    console.log('🎯 关键验证点:');
    console.log('   1. ✅ 只显示一个远程设备（无重复）');
    console.log('   2. ✅ 刷新后仍然只有一个远程设备');
    console.log('   3. ✅ 连接过程正常显示');
    console.log('   4. ✅ 编辑器显示已连接状态（最重要）');
    console.log('   5. ✅ 设备图标状态正确');
    console.log('   6. ✅ 上传功能正常工作');
    console.log('   7. ✅ 断开连接功能正常');
    console.log('   8. ✅ 重复连接测试正常');
    console.log('');
    
    console.log('🔧 如果问题仍然存在:');
    console.log('   1. 重复设备问题：');
    console.log('      - 重启应用程序，清除缓存');
    console.log('      - 检查控制台是否有重复添加日志');
    console.log('   2. 连接状态问题：');
    console.log('      - 检查VM连接事件是否正确触发');
    console.log('      - 查看PERIPHERAL_CONNECTED事件日志');
    console.log('      - 确认超时机制是否生效');
    console.log('   3. 查看控制台日志获取详细错误信息');
    console.log('   4. 确保远程服务器正常运行');
    console.log('');
    console.log('🎉 开始综合测试！');
}

/**
 * 主函数
 */
async function main() {
    console.log('开始综合修复功能测试...');
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
