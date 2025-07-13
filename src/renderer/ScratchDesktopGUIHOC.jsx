import {ipcRenderer, clipboard} from 'electron';
import {dialog} from '@electron/remote';
import * as remote from '@electron/remote/renderer';
import bindAll from 'lodash.bindall';
import omit from 'lodash.omit';
import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import GUIComponent from 'openblock-gui/src/components/gui/gui.jsx';
import {FormattedMessage} from 'react-intl';

import {
    LoadingStates,
    onFetchedProjectData,
    onLoadedProject,
    defaultProjectId,
    requestNewProject,
    requestProjectUpload,
    setProjectId
} from 'openblock-gui/src/reducers/project-state';
import {
    openLoadingProject,
    closeLoadingProject,
    openTelemetryModal,
    openUpdateModal
} from 'openblock-gui/src/reducers/modals';
import {setUpdate} from 'openblock-gui/src/reducers/update';
import {setDeviceData} from 'openblock-gui/src/reducers/device-data';

import analytics, {initialAnalytics} from 'openblock-gui/src/lib/analytics';
import MessageBoxType from 'openblock-gui/src/lib/message-box.js';
import {makeDeviceLibrary} from 'openblock-gui/src//lib/libraries/devices/index.jsx';

import ElectronStorageHelper from '../common/ElectronStorageHelper';

import showPrivacyPolicy from './showPrivacyPolicy';

/**
 * Higher-order component to add desktop logic to the GUI.
 * @param {Component} WrappedComponent - a GUI-like component to wrap.
 * @returns {Component} - a component similar to GUI with desktop-specific logic added.
 */
const ScratchDesktopGUIHOC = function (WrappedComponent) {
    class ScratchDesktopGUIComponent extends React.Component {
        constructor (props) {
            super(props);
            bindAll(this, [
                'handleProjectTelemetryEvent',
                'handleSetTitleFromSave',
                'handleShowMessageBox',
                'handleStorageInit',
                'handleUpdateProjectTitle',
                'handleClickRemoteFlasherSettings'
            ]);
            this.props.onLoadingStarted();
            ipcRenderer.invoke('get-initial-project-data').then(async initialProjectData => {
                const hasInitialProject = initialProjectData && (initialProjectData.length > 0);
                this.props.onHasInitialProject(hasInitialProject, this.props.loadingState);
                if (!hasInitialProject) {
                    this.props.onLoadingCompleted();
                    ipcRenderer.send('loading-completed');
                    return;
                }
                // Update device list
                await this.props.vm.extensionManager.getDeviceList().then(data => {
                    this.props.onSetDeviceData(makeDeviceLibrary(data));
                })
                    .catch(() => {
                        this.props.onSetDeviceData(makeDeviceLibrary());
                    });
                this.props.vm.loadProject(initialProjectData).then(
                    () => {
                        this.props.onLoadingCompleted();
                        ipcRenderer.send('loading-completed');
                        this.props.onLoadedProject(this.props.loadingState, true);
                    },
                    e => {
                        this.props.onLoadingCompleted();
                        ipcRenderer.send('loading-completed');
                        this.props.onLoadedProject(this.props.loadingState, false);
                        dialog.showMessageBox(remote.getCurrentWindow(), {
                            type: 'error',
                            title: 'Failed to load project',
                            message: 'Invalid or corrupt project file.',
                            detail: e.message
                        });

                        // this effectively sets the default project ID
                        // TODO: maybe setting the default project ID should be implicit in `requestNewProject`
                        this.props.onHasInitialProject(false, this.props.loadingState);

                        // restart as if we didn't have an initial project to load
                        this.props.onRequestNewProject();
                    }
                );
            });
            ipcRenderer.send('set-locale', this.props.locale);
        }
        componentDidMount () {
            // replace navigator.clipboard.readText to Electron's clipboard.readText
            navigator.clipboard.readText = () => Promise.resolve(clipboard.readText());

            ipcRenderer.on('setTitleFromSave', this.handleSetTitleFromSave);
            ipcRenderer.on('setUpdate', (event, args) => {
                this.props.onSetUpdate(args);
            });
            ipcRenderer.on('setUserId', (event, args) => {
                initialAnalytics(args);
                // Register "base" page view
                analytics.send({hitType: 'pageview', page: '/community/electron'});
            });
            ipcRenderer.on('setPlatform', (event, args) => {
                this.platform = args;
            });
        }
        componentWillUnmount () {
            ipcRenderer.removeListener('setTitleFromSave', this.handleSetTitleFromSave);
        }
        handleClickAbout () {
            ipcRenderer.send('open-about-window');
        }
        handleClickLicense () {
            ipcRenderer.send('open-license-window');
        }
        handleClickCheckUpdate () {
            ipcRenderer.send('reqeustCheckUpdate');
        }
        handleClickUpdate () {
            ipcRenderer.send('reqeustUpdate');
        }
        handleAbortUpdate () {
            ipcRenderer.send('abortUpdate');
        }
        handleClickClearCache () {
            ipcRenderer.send('clearCache');
        }
        handleClickInstallDriver () {
            ipcRenderer.send('installDriver');
        }

        handleClickRemoteFlasherSettings () {
            console.log('Remote Flasher Settings clicked');
            try {
                this.showRemoteFlasherDialog();
            } catch (error) {
                console.error('Error in handleClickRemoteFlasherSettings:', error);
                dialog.showErrorBox('Error', `Failed to open remote flasher settings: ${error.message}`);
            }
        }
        handleProjectTelemetryEvent (event, metadata) {
            ipcRenderer.send(event, metadata);
        }
        handleSetTitleFromSave (event, args) {
            this.handleUpdateProjectTitle(args.title);
        }
        handleStorageInit (storageInstance) {
            storageInstance.addHelper(new ElectronStorageHelper(storageInstance));
        }
        handleUpdateProjectTitle (newTitle) {
            this.setState({projectTitle: newTitle});
        }
        async showRemoteFlasherDialog () {
            console.log('showRemoteFlasherDialog called');
            try {
                // 获取当前配置
                console.log('Getting remote flasher config...');
                const currentConfig = await ipcRenderer.invoke('getRemoteFlasherConfig');
                console.log('Current config:', currentConfig);

                // 显示配置对话框
                const result = await dialog.showMessageBox(remote.getCurrentWindow(), {
                    type: 'question',
                    title: 'Remote Flasher Settings',
                    message: 'Configure Remote Flasher (FangtangLink)',
                    detail: `Current status: ${currentConfig.enabled ? 'Enabled' : 'Disabled'}\n` +
                           `Server URL: ${currentConfig.serverUrl || 'Not set'}\n\n` +
                           'Would you like to configure remote flashing?',
                    buttons: ['Configure', 'Test Connection', 'Disable', 'Cancel'],
                    defaultId: 0,
                    cancelId: 3
                });

                if (result.response === 0) {
                    // 配置远程烧录
                    this.showRemoteFlasherConfigDialog(currentConfig);
                } else if (result.response === 1) {
                    // 测试连接
                    if (currentConfig.serverUrl) {
                        this.testRemoteFlasherConnection(currentConfig.serverUrl);
                    } else {
                        dialog.showMessageBox(remote.getCurrentWindow(), {
                            type: 'warning',
                            title: 'No Server URL',
                            message: 'Please configure a server URL first.'
                        });
                    }
                } else if (result.response === 2) {
                    // 禁用远程烧录
                    await ipcRenderer.invoke('setRemoteFlasherConfig', {
                        enabled: false,
                        serverUrl: currentConfig.serverUrl
                    });
                    dialog.showMessageBox(remote.getCurrentWindow(), {
                        type: 'info',
                        title: 'Remote Flasher Disabled',
                        message: 'Remote flashing has been disabled.'
                    });
                }
            } catch (error) {
                console.error('Error showing remote flasher dialog:', error);
                dialog.showErrorBox('Error', 'Failed to show remote flasher settings.');
            }
        }
        async showRemoteFlasherConfigDialog (currentConfig) {
            // 使用更简单的方法获取用户输入
            let serverUrl = null;

            try {
                // 首先显示当前配置
                const configInfo = await dialog.showMessageBox(remote.getCurrentWindow(), {
                    type: 'info',
                    title: 'Current Configuration',
                    message: 'Remote Flasher Configuration',
                    detail: `Current server URL: ${currentConfig.serverUrl || 'Not configured'}\n\n` +
                           'Click OK to enter a new server URL, or Cancel to abort.',
                    buttons: ['Enter New URL', 'Cancel'],
                    defaultId: 0,
                    cancelId: 1
                });

                if (configInfo.response !== 0) {
                    return; // 用户取消
                }

                // 使用简单的prompt获取输入
                serverUrl = await this.showInputDialog(
                    'Remote Flasher Configuration',
                    'Enter the IP address or URL of your Raspberry Pi running FangtangLink:',
                    currentConfig.serverUrl || 'http://192.168.0.109:5000'
                );
            } catch (error) {
                console.error('Error in config dialog:', error);
                dialog.showErrorBox('Error', 'Failed to show configuration dialog.');
                return;
            }

            if (serverUrl) {
                try {
                    // 测试连接
                    const testResult = await ipcRenderer.invoke('testRemoteFlasherConnection', serverUrl);

                    if (testResult.success) {
                        // 保存配置
                        await ipcRenderer.invoke('setRemoteFlasherConfig', {
                            enabled: true,
                            serverUrl: serverUrl
                        });

                        dialog.showMessageBox(remote.getCurrentWindow(), {
                            type: 'info',
                            title: 'Remote Flasher Configured',
                            message: `Remote flasher has been configured successfully!\n\nServer: ${serverUrl}\nStatus: Connected\n\nYou can now use "Remote Arduino (FangtangLink)" device for wireless programming.`
                        });
                    } else {
                        const retry = await dialog.showMessageBox(remote.getCurrentWindow(), {
                            type: 'warning',
                            title: 'Connection Failed',
                            message: `Failed to connect to remote flasher:\n${testResult.message}\n\nWould you like to save the configuration anyway?`,
                            buttons: ['Save Anyway', 'Retry', 'Cancel'],
                            defaultId: 1,
                            cancelId: 2
                        });

                        if (retry.response === 0) {
                            // 保存配置但不启用
                            await ipcRenderer.invoke('setRemoteFlasherConfig', {
                                enabled: false,
                                serverUrl: serverUrl
                            });

                            dialog.showMessageBox(remote.getCurrentWindow(), {
                                type: 'info',
                                title: 'Configuration Saved',
                                message: 'Configuration saved but remote flasher is disabled due to connection failure.'
                            });
                        } else if (retry.response === 1) {
                            // 重试
                            this.showRemoteFlasherConfigDialog({serverUrl: serverUrl});
                        }
                    }
                } catch (error) {
                    console.error('Error configuring remote flasher:', error);
                    dialog.showErrorBox('Error', 'Failed to configure remote flasher.');
                }
            }
        }
        async testRemoteFlasherConnection (serverUrl) {
            try {
                const testResult = await ipcRenderer.invoke('testRemoteFlasherConnection', serverUrl);

                dialog.showMessageBox(remote.getCurrentWindow(), {
                    type: testResult.success ? 'info' : 'warning',
                    title: 'Connection Test',
                    message: testResult.success ?
                        `Connection successful!\n\nServer: ${serverUrl}\nStatus: ${testResult.message}` :
                        `Connection failed!\n\nServer: ${serverUrl}\nError: ${testResult.message}`
                });
            } catch (error) {
                console.error('Error testing remote flasher connection:', error);
                dialog.showErrorBox('Error', 'Failed to test connection.');
            }
        }
        async showInputDialog (title, message, defaultValue = '') {
            // 简化的输入对话框实现
            console.log('showInputDialog called:', { title, message, defaultValue });

            return new Promise((resolve) => {
                try {
                    // 创建模态对话框元素
                    const modal = document.createElement('div');
                    modal.style.cssText = `
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background-color: rgba(0, 0, 0, 0.7);
                        z-index: 10000;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        font-family: Arial, sans-serif;
                    `;

                    const dialog = document.createElement('div');
                    dialog.style.cssText = `
                        background: white;
                        padding: 20px;
                        border-radius: 8px;
                        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                        max-width: 500px;
                        width: 90%;
                    `;

                    const titleEl = document.createElement('h3');
                    titleEl.textContent = title;
                    titleEl.style.cssText = `
                        margin: 0 0 10px 0;
                        color: #333;
                        font-size: 18px;
                    `;

                    const messageEl = document.createElement('p');
                    messageEl.textContent = message;
                    messageEl.style.cssText = `
                        margin: 0 0 15px 0;
                        color: #666;
                        font-size: 14px;
                        line-height: 1.4;
                    `;

                    const input = document.createElement('input');
                    input.type = 'text';
                    input.value = defaultValue || '';
                    input.style.cssText = `
                        width: 100%;
                        padding: 10px;
                        border: 2px solid #ddd;
                        border-radius: 4px;
                        font-size: 14px;
                        margin-bottom: 15px;
                        box-sizing: border-box;
                    `;

                    const buttonContainer = document.createElement('div');
                    buttonContainer.style.cssText = `
                        display: flex;
                        justify-content: flex-end;
                        gap: 10px;
                    `;

                    const cancelBtn = document.createElement('button');
                    cancelBtn.textContent = 'Cancel';
                    cancelBtn.style.cssText = `
                        padding: 8px 16px;
                        border: 1px solid #ddd;
                        background: #f5f5f5;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                    `;

                    const okBtn = document.createElement('button');
                    okBtn.textContent = 'OK';
                    okBtn.style.cssText = `
                        padding: 8px 16px;
                        border: 1px solid #007acc;
                        background: #007acc;
                        color: white;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                    `;

                    // 组装对话框
                    dialog.appendChild(titleEl);
                    dialog.appendChild(messageEl);
                    dialog.appendChild(input);
                    buttonContainer.appendChild(cancelBtn);
                    buttonContainer.appendChild(okBtn);
                    dialog.appendChild(buttonContainer);
                    modal.appendChild(dialog);

                    // 添加到页面
                    document.body.appendChild(modal);

                    // 聚焦输入框
                    setTimeout(() => {
                        input.focus();
                        input.select();
                    }, 100);

                    const cleanup = () => {
                        if (modal.parentNode) {
                            document.body.removeChild(modal);
                        }
                    };

                    const handleOk = () => {
                        const value = input.value.trim();
                        cleanup();
                        resolve(value || null);
                    };

                    const handleCancel = () => {
                        cleanup();
                        resolve(null);
                    };

                    // 事件监听
                    okBtn.addEventListener('click', handleOk);
                    cancelBtn.addEventListener('click', handleCancel);

                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            handleOk();
                        } else if (e.key === 'Escape') {
                            e.preventDefault();
                            handleCancel();
                        }
                    });

                    modal.addEventListener('click', (e) => {
                        if (e.target === modal) {
                            handleCancel();
                        }
                    });

                } catch (error) {
                    console.error('Error creating input dialog:', error);
                    // 备用方案
                    try {
                        const result = prompt(`${title}\n\n${message}`, defaultValue);
                        resolve(result);
                    } catch (promptError) {
                        console.error('Prompt fallback failed:', promptError);
                        resolve(null);
                    }
                }
            });
        }
        handleShowMessageBox (type, message) {
            /**
             * To avoid the electron bug: the input-box lose focus after call alert or confirm on windows platform.
             * https://github.com/electron/electron/issues/19977
            */
            if (this.platform === 'win32') {
                let options;
                if (type === MessageBoxType.confirm) {
                    options = {
                        type: 'warning',
                        buttons: ['Ok', 'Cancel'],
                        message: message
                    };
                } else if (type === MessageBoxType.alert) {
                    options = {
                        type: 'error',
                        message: message
                    };
                }
                const result = dialog.showMessageBoxSync(remote.getCurrentWindow(), options);
                if (result === 0) {
                    return true;
                }
                return false;
            }
            if (type === 'confirm') {
                return confirm(message); // eslint-disable-line no-alert
            }
            return alert(message); // eslint-disable-line no-alert
        }
        render () {
            const childProps = omit(this.props, Object.keys(ScratchDesktopGUIComponent.propTypes));

            return (<WrappedComponent
                canEditTitle
                canModifyCloudData={false}
                canSave={false}
                isScratchDesktop
                onClickAbout={[
                    {
                        title: (<FormattedMessage
                            defaultMessage="About"
                            description="Menu bar item for about"
                            id="gui.desktopMenuBar.about"
                        />),
                        onClick: () => this.handleClickAbout()
                    },
                    {
                        title: (<FormattedMessage
                            defaultMessage="License"
                            description="Menu bar item for license"
                            id="gui.desktopMenuBar.license"
                        />),
                        onClick: () => this.handleClickLicense()
                    },
                    {
                        title: (<FormattedMessage
                            defaultMessage="Privacy policy"
                            description="Menu bar item for privacy policy"
                            id="gui.menuBar.privacyPolicy"
                        />),
                        onClick: () => showPrivacyPolicy()
                    },
                    {
                        title: (<FormattedMessage
                            defaultMessage="Data settings"
                            description="Menu bar item for data settings"
                            id="gui.menuBar.dataSettings"
                        />),
                        onClick: () => this.props.onTelemetrySettingsClicked()
                    },
                    {
                        title: (<FormattedMessage
                            defaultMessage="Remote Flasher Settings"
                            description="Menu bar item for remote flasher settings"
                            id="gui.menuBar.remoteFlasherSettings"
                        />),
                        onClick: () => this.handleClickRemoteFlasherSettings()
                    }
                ]}
                onClickLogo={this.handleClickLogo}
                onClickCheckUpdate={this.handleClickCheckUpdate}
                onClickUpdate={this.handleClickUpdate}
                onAbortUpdate={this.handleAbortUpdate}
                onClickInstallDriver={this.handleClickInstallDriver}
                onClickClearCache={this.handleClickClearCache}
                onProjectTelemetryEvent={this.handleProjectTelemetryEvent}
                onShowMessageBox={this.handleShowMessageBox}
                onShowPrivacyPolicy={showPrivacyPolicy}
                onStorageInit={this.handleStorageInit}
                onUpdateProjectTitle={this.handleUpdateProjectTitle}

                // allow passed-in props to override any of the above
                {...childProps}
            />);
        }
    }

    ScratchDesktopGUIComponent.propTypes = {
        loadingState: PropTypes.oneOf(LoadingStates),
        locale: PropTypes.string.isRequired,
        onFetchedInitialProjectData: PropTypes.func,
        onHasInitialProject: PropTypes.func,
        onLoadedProject: PropTypes.func,
        onLoadingCompleted: PropTypes.func,
        onLoadingStarted: PropTypes.func,
        onRequestNewProject: PropTypes.func,
        onTelemetrySettingsClicked: PropTypes.func,
        onSetDeviceData: PropTypes.func.isRequired,
        onSetUpdate: PropTypes.func,
        // using PropTypes.instanceOf(VM) here will cause prop type warnings due to VM mismatch
        vm: GUIComponent.WrappedComponent.propTypes.vm
    };
    const mapStateToProps = state => {
        const loadingState = state.scratchGui.projectState.loadingState;
        return {
            loadingState: loadingState,
            locale: state.locales.locale,
            vm: state.scratchGui.vm
        };
    };
    const mapDispatchToProps = dispatch => ({
        onLoadingStarted: () => dispatch(openLoadingProject()),
        onLoadingCompleted: () => dispatch(closeLoadingProject()),
        onHasInitialProject: (hasInitialProject, loadingState) => {
            if (hasInitialProject) {
                // emulate sb-file-uploader
                return dispatch(requestProjectUpload(loadingState));
            }

            // `createProject()` might seem more appropriate but it's not a valid state transition here
            // setting the default project ID is a valid transition from NOT_LOADED and acts like "create new"
            return dispatch(setProjectId(defaultProjectId));
        },
        onFetchedInitialProjectData: (projectData, loadingState) =>
            dispatch(onFetchedProjectData(projectData, loadingState)),
        onLoadedProject: (loadingState, loadSuccess) => {
            const canSaveToServer = false;
            return dispatch(onLoadedProject(loadingState, canSaveToServer, loadSuccess));
        },
        onRequestNewProject: () => dispatch(requestNewProject(false)),
        onSetDeviceData: data => dispatch(setDeviceData(data)),
        onSetUpdate: arg => {
            dispatch(setUpdate(arg));
            dispatch(openUpdateModal());
        },
        onTelemetrySettingsClicked: () => dispatch(openTelemetryModal())
    });

    return connect(mapStateToProps, mapDispatchToProps)(ScratchDesktopGUIComponent);
};

export default ScratchDesktopGUIHOC;
