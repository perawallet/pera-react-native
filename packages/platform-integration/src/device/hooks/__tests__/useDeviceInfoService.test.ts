/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { describe, test, expect, vi } from 'vitest'
import { container } from 'tsyringe'
import { DeviceInfoServiceContainerKey, useDeviceInfoService } from '../index'
import { DevicePlatforms, type DeviceInfoService } from '../../models'

vi.mock('../../../services/blockchain', () => ({
    Networks: {
        mainnet: 'mainnet',
        testnet: 'testnet',
    },
}))

vi.mock('../../../api/query-client', () => ({
    createFetchClient: vi.fn(() => vi.fn()),
    logRequest: vi.fn(),
    logResponse: vi.fn(),
}))

describe('services/device/platform-service', () => {
    test('useDeviceInfoService resolves the registered DeviceInfoService from the container', () => {
        const dummy: DeviceInfoService = {
            initializeDeviceInfo: vi.fn(),
            getDeviceID: vi.fn(() => Promise.resolve('id')),
            getDeviceModel: vi.fn(() => 'testModel'),
            getDevicePlatform: vi.fn(() => DevicePlatforms.web),
            getDeviceLocale: vi.fn(() => 'testLanguage'),
            getUserAgent: vi.fn(() => 'user_agent'),
            getAppVersion: vi.fn(() => '1.0.0-test'),
        }

        container.register(DeviceInfoServiceContainerKey, { useValue: dummy })

        const svc = useDeviceInfoService()
        expect(svc).toBe(dummy)

        svc.initializeDeviceInfo()
        expect(dummy.initializeDeviceInfo).toHaveBeenCalledTimes(1)
    })
})
