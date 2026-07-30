/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const handleAutoLockAlarmMock = vi.fn().mockResolvedValue(undefined)
const ensureOffscreenDocumentMock = vi.fn().mockResolvedValue(undefined)
const installWcApprovalRouterMock = vi.fn()
const installWcHeartbeatMock = vi.fn()

vi.mock('@perawallet/wallet-extension-keystore-chrome/vault/autolock', () => ({
    handleAutoLockAlarm: handleAutoLockAlarmMock,
}))

// index.ts pulls in the ARC-0027 dapp relay + passkey relay wiring, which is
// out of scope here — only the onAlarm dispatch (heartbeat vs. auto-lock) is
// under test, so those classes are stubbed to inert no-ops.
vi.mock('@perawallet/wallet-extension-platform-chrome', () => ({
    ApprovalWindowBridge: class {
        listen = vi.fn()
    },
    ChromeDappRouter: class {
        listen = vi.fn()
    },
    DB_CONTROL_SCOPE: 'pera-db-control',
    DappPermissionStore: class {},
    PasskeyRouter: class {
        listen = vi.fn()
    },
    WC_CONTROL_SCOPE: 'pera-wc-control',
    // connect-modal-pair.ts (pulled in transitively via ../index) imports
    // this guard directly — omitting it here is a trap: it's only touched
    // once a test actually delivers a message through the SW's listeners,
    // so a currently-green suite can still throw vitest's "no export
    // defined on mock" the moment a future test does that.
    isWcPagePairMessage: vi.fn().mockReturnValue(false),
    ensureDeviceID: vi.fn(),
    startStorageProxyHost: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    getNetworkConfig: vi.fn(),
    // The entry point logs its resolved config identity at module scope, so
    // the mock has to carry `config` even though these tests only exercise
    // alarm routing.
    config: {
        appEnvironment: 'development',
        appBuildNumber: '',
        backendAPIKey: '',
    },
}))

vi.mock('../offscreen', () => ({
    ensureOffscreenDocument: ensureOffscreenDocumentMock,
}))

vi.mock('../network', () => ({
    parseActiveNetwork: vi.fn(),
}))

vi.mock('../walletconnect', () => ({
    WC_HEARTBEAT_ALARM: 'pera-wc-heartbeat',
    installWcApprovalRouter: installWcApprovalRouterMock,
    installWcHeartbeat: installWcHeartbeatMock,
}))

type AlarmListener = (alarm: chrome.alarms.Alarm) => void

describe('background/index onAlarm routing', () => {
    let onAlarmListener: AlarmListener

    beforeEach(async () => {
        vi.resetModules()
        handleAutoLockAlarmMock.mockClear()
        ensureOffscreenDocumentMock.mockClear()

        globalThis.chrome = {
            runtime: {
                id: 'ext-id',
                getURL: (path: string) => `chrome-extension://ext-id/${path}`,
                onInstalled: { addListener: vi.fn() },
                onStartup: { addListener: vi.fn() },
                onMessage: { addListener: vi.fn() },
                sendMessage: vi.fn(),
            },
            alarms: {
                onAlarm: {
                    addListener: vi.fn((listener: AlarmListener) => {
                        onAlarmListener = listener
                    }),
                },
                create: vi.fn(),
            },
            storage: { local: {} },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any

        await import('../index')
    })

    it('still routes a non-heartbeat alarm to handleAutoLockAlarm', () => {
        const alarm = { name: 'pera-auto-lock' } as chrome.alarms.Alarm
        onAlarmListener(alarm)

        expect(handleAutoLockAlarmMock).toHaveBeenCalledWith(alarm)
    })

    it('does not forward the heartbeat alarm to handleAutoLockAlarm', () => {
        const alarm = { name: 'pera-wc-heartbeat' } as chrome.alarms.Alarm
        onAlarmListener(alarm)

        expect(handleAutoLockAlarmMock).not.toHaveBeenCalled()
        expect(ensureOffscreenDocumentMock).toHaveBeenCalled()
    })

    // A rejected ensureOffscreenDocument()/sendMessage() in the heartbeat
    // path must not surface as an unhandled promise rejection — this is a
    // background sweep with nobody awaiting its result, not a dApp request
    // that needs an answer.
    it('does not leave an unhandled rejection when ensureOffscreenDocument fails on a heartbeat tick', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        const boom = new Error('offscreen creation failed')
        ensureOffscreenDocumentMock.mockRejectedValueOnce(boom)
        const alarm = { name: 'pera-wc-heartbeat' } as chrome.alarms.Alarm

        expect(() => onAlarmListener(alarm)).not.toThrow()

        await vi.waitFor(() => {
            expect(errorSpy).toHaveBeenCalledWith(
                expect.stringContaining('wc heartbeat'),
                boom,
            )
        })
        errorSpy.mockRestore()
    })
})
