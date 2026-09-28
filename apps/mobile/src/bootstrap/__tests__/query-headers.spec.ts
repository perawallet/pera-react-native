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

import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    updateBackendHeaders: vi.fn(),
    deviceInfo: {
        getAppName: () => 'Pera',
        getAppPackage: () => 'com.pera',
        getAppVersion: () => '1.2.3',
        getDevicePlatform: () => 'ios',
        getDeviceLocale: () => 'en-US',
        getDeviceOSVersion: () => '17.4',
        getDeviceModelId: () => 'iPhone15,2',
        getUserAgent: () => 'pera-ua',
    },
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    updateBackendHeaders: mocks.updateBackendHeaders,
}))
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({ deviceInfo: mocks.deviceInfo }),
}))

import { updateQueryHeaders } from '../query-headers'

describe('updateQueryHeaders', () => {
    it('sends the device identity headers to the backend client', () => {
        updateQueryHeaders()

        expect(mocks.updateBackendHeaders).toHaveBeenCalledTimes(1)
        const headers = mocks.updateBackendHeaders.mock.calls[0][0]
        expect(Object.fromEntries(headers)).toEqual({
            'App-Name': 'Pera',
            'App-Package-Name': 'com.pera',
            'App-Version': '1.2.3',
            'Client-Type': 'ios',
            'Device-Version': 'en-US',
            'Device-OS-Version': '17.4',
            'Device-Model': 'iPhone15,2',
            'User-Agent': 'pera-ua',
        })
    })
})
