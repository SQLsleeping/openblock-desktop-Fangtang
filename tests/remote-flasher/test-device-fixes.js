#!/usr/bin/env node

/**
 * 测试Remote Arduino设备修复
 * 验证设备重复显示和连接状态同步问题的修复
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 测试Remote Arduino设备修复');
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
 * 启动应用程序并指导测试
 */
async function startAppAndGuideTest() {
    console.log('🚀 启动OpenBlock Desktop进行测试...');
    
    try {
        const appProcess = spawn('npm', ['start'], {
            cwd: path.resolve(__dirname, '../..'),
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: true
        });

        let appStarted = false;

        appProcess.stdout.on('data', (data) => {
            const output = data.toString();
            console.log(output);
            
            // 检查应用是否启动成功
            if (output.includes('webpack: Compiled successfully') || 
                output.includes('App is ready') ||
                output.includes('ready')) {
                appStarted = true;
                console.log('✅ OpenBlock Desktop 启动成功');
                showTestInstructions();
            }
        });

        appProcess.stderr.on('data', (data) => {
            const output = data.toString();
            if (!output.includes('DeprecationWarning') && 
                !output.includes('ExperimentalWarning')) {
                console.error('应用错误:', output);
            }
        });

        appProcess.on('close', (code) => {
            console.log(`应用程序退出，代码: ${code}`);
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
    console.log('📋 设备修复验证测试步骤:');
    console.log('=' .repeat(50));
    console.log('');
    
    console.log('🔍 第一步：验证设备重复显示修复');
    console.log('   1. 点击 "连接设备" 按钮');
    console.log('   2. 选择Arduino设备类型');
    console.log('   3. 查看设备列表，应该只看到一个 "Remote Arduino (FangtangLink)" 设备');
    console.log('   4. 点击 "Refresh" 按钮多次，验证远程设备不会重复出现');
    console.log('   5. 关闭设备选择界面，重新打开，验证远程设备仍然只显示一次');
    console.log('');
    
    console.log('🔗 第二步：验证连接状态同步修复（OR关系）');
    console.log('   1. 选择 "Remote Arduino (FangtangLink)" 设备');
    console.log('   2. 点击 "Connect" 按钮');
    console.log('   3. 观察连接过程，应该显示连接成功');
    console.log('   4. 返回编辑器界面，检查连接状态指示器');
    console.log('   5. 连接状态应该显示为已连接（绿色或已连接图标）');
    console.log('   6. 设备名称应该显示为 "Remote Arduino"');
    console.log('   7. 注意：现在使用OR关系，任一连接状态更新成功即可');
    console.log('');
    
    console.log('🧪 第三步：验证烧录功能');
    console.log('   1. 在编辑器中创建一个简单的Arduino程序');
    console.log('   2. 点击 "上传到设备" 按钮');
    console.log('   3. 观察上传过程，应该显示远程烧录信息');
    console.log('   4. 验证烧录成功完成');
    console.log('');
    
    console.log('🔄 第四步：验证断开连接');
    console.log('   1. 点击设备连接状态，选择断开连接');
    console.log('   2. 验证连接状态正确更新为未连接');
    console.log('   3. 重新连接，验证连接状态再次正确同步');
    console.log('');
    
    console.log('✅ 预期结果:');
    console.log('   - Remote Arduino设备在设备列表中只显示一次');
    console.log('   - 刷新设备列表不会导致重复显示');
    console.log('   - 连接成功后编辑器界面显示已连接状态');
    console.log('   - 连接状态指示器正确显示绿色/已连接');
    console.log('   - 设备名称正确显示');
    console.log('   - 烧录功能正常工作');
    console.log('   - 断开连接状态正确同步');
    console.log('');
    
    console.log('❌ 如果仍有问题:');
    console.log('   1. 检查控制台是否有错误信息');
    console.log('   2. 验证远程服务器是否正常运行');
    console.log('   3. 检查远程烧录配置是否正确');
    console.log('   4. 重启应用程序重新测试');
    console.log('');
    
    console.log('🎯 关键验证点:');
    console.log('   ✓ 设备列表中Remote Arduino只显示一次');
    console.log('   ✓ 刷新不会导致重复显示');
    console.log('   ✓ 支持多种设备ID格式（remote-arduino, remote-flasher-device等）');
    console.log('   ✓ 连接成功后状态正确同步到编辑器（OR关系）');
    console.log('   ✓ 连接状态指示器正确显示');
    console.log('   ✓ 烧录功能正常');
    console.log('   ✓ 断开连接状态正确同步（OR关系）');
    console.log('   ✓ 错误处理：即使部分状态更新失败，连接仍然有效');
    console.log('');
    
    console.log('🎉 开始测试！按 Ctrl+C 停止应用程序');
}

/**
 * 主函数
 */
async function main() {
    console.log('开始Remote Arduino设备修复验证测试...');
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
