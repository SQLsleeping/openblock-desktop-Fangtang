import {app} from 'electron';
import path from 'path';
import os from 'os';
import {execFile, spawn} from 'child_process';
import fs from 'fs-extra';

import sudo from 'sudo-prompt';
import {productName} from '../../package.json';

import OpenBlockLink from 'openblock-link';
import OpenblockResourceServer from 'openblock-resource';
import RemoteFlasherClient from './RemoteFlasherClient';

class OpenblockDesktopLink {
    constructor () {
        this._resourceServer = null;
        this._remoteFlasherClient = null;
        this._remoteFlasherEnabled = false;
        this._remoteFlasherUrl = null;

        this.appPath = app.getAppPath();
        if (this.appPath.search(/app/g) !== -1) {
            // Normal app
            this.appPath = path.join(this.appPath, '../../');
        } else if (this.appPath.search(/main/g) !== -1) { // eslint-disable-line no-negated-condition
            // Start by start script in debug mode.
            this.appPath = path.join(this.appPath, '../../');
        } else {
            // App in dir mode
            this.appPath = path.join(this.appPath, '../');
        }

        const userDataPath = app.getPath(
            'userData'
        );
        this.dataPath = path.join(userDataPath, 'Data');

        const cacheResourcesPath = path.join(this.dataPath, 'external-resources');
        if (!fs.existsSync(cacheResourcesPath)) {
            fs.mkdirSync(cacheResourcesPath, {recursive: true});
        }

        this._link = new OpenBlockLink(this.dataPath, path.join(this.appPath, 'tools'));
        this._resourceServer = new OpenblockResourceServer(cacheResourcesPath,
            path.join(this.appPath, 'external-resources'),
            app.getLocaleCountryCode());

        // 加载远程烧录配置
        this.loadRemoteFlasherConfig();
    }

    get resourceServer () {
        return this._resourceServer;
    }

    installDriver (callback = null) {
        const driverPath = path.join(this.appPath, 'drivers');
        if ((os.platform() === 'win32') && (os.arch() === 'x64')) {
            execFile('install_x64.bat', [], {cwd: driverPath});
        } else if ((os.platform() === 'win32') && (os.arch() === 'ia32')) {
            execFile('install_x86.bat', [], {cwd: driverPath});
        } else if ((os.platform() === 'darwin')) {
            spawn('sh', ['install.sh'], {shell: true, cwd: driverPath});
        } else if ((os.platform() === 'linux')) {
            sudo.exec(`sh ${path.join(driverPath, 'linux_setup.sh')} yang`, {name: productName},
                error => {
                    if (error) throw error;
                    if (callback) {
                        callback();
                    }
                }
            );
        }
    }

    clearCache (reboot = true) {
        if (fs.existsSync(this.dataPath)) {
            fs.rmSync(this.dataPath, {recursive: true, force: true});
        }
        if (reboot){
            app.relaunch();
            app.exit();
        }
    }

    start () {
        this._link.listen();

        // start resource server
        this._resourceServer.listen();
    }

    /**
     * 加载远程烧录配置
     */
    loadRemoteFlasherConfig() {
        try {
            const configPath = path.join(this.dataPath, 'remote-flasher-config.json');
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                this._remoteFlasherEnabled = config.enabled || false;
                this._remoteFlasherUrl = config.serverUrl || null;

                if (this._remoteFlasherEnabled && this._remoteFlasherUrl) {
                    this._remoteFlasherClient = new RemoteFlasherClient(this._remoteFlasherUrl);
                }
            }
        } catch (error) {
            console.error('Failed to load remote flasher config:', error);
            this._remoteFlasherEnabled = false;
        }
    }

    /**
     * 保存远程烧录配置
     */
    saveRemoteFlasherConfig(enabled, serverUrl) {
        try {
            const config = {
                enabled: enabled,
                serverUrl: serverUrl,
                lastUpdated: new Date().toISOString()
            };

            const configPath = path.join(this.dataPath, 'remote-flasher-config.json');
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

            this._remoteFlasherEnabled = enabled;
            this._remoteFlasherUrl = serverUrl;

            if (enabled && serverUrl) {
                this._remoteFlasherClient = new RemoteFlasherClient(serverUrl);
            } else {
                this._remoteFlasherClient = null;
            }

            return true;
        } catch (error) {
            console.error('Failed to save remote flasher config:', error);
            return false;
        }
    }

    /**
     * 获取远程烧录配置
     */
    getRemoteFlasherConfig() {
        return {
            enabled: this._remoteFlasherEnabled,
            serverUrl: this._remoteFlasherUrl
        };
    }

    /**
     * 测试远程烧录连接
     */
    async testRemoteFlasherConnection(serverUrl) {
        try {
            const testClient = new RemoteFlasherClient(serverUrl);
            return await testClient.testConnection();
        } catch (error) {
            return {
                success: false,
                message: 'Connection test failed',
                error: error.message
            };
        }
    }

    /**
     * 获取远程烧录客户端
     */
    getRemoteFlasherClient() {
        return this._remoteFlasherClient;
    }

    /**
     * 检查是否启用远程烧录
     */
    isRemoteFlasherEnabled() {
        return this._remoteFlasherEnabled && this._remoteFlasherClient !== null;
    }
}

export default OpenblockDesktopLink;
