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
    const createMockDeviceInfoService = (): DeviceInfoService => ({
        initializeDeviceInfo: vi.fn(),
        getDeviceID: vi.fn(() => Promise.resolve('test-device-id')),
        getDeviceModel: vi.fn(() => 'iPhone 15 Pro'),
        getDevicePlatform: vi.fn(() => DevicePlatforms.ios),
        getDeviceLocale: vi.fn(() => 'en-US'),
        getDeviceCountry: vi.fn(() => 'US'),
        getUserAgent: vi.fn(() => 'Pera/1.0.0 (iOS; iPhone 15 Pro)'),
        getAppVersion: vi.fn(() => '1.0.0'),
        getAppBuild: vi.fn(() => '123'),
        getAppName: vi.fn(() => 'Pera Wallet'),
        getAppId: vi.fn(() => '1459898525'),
        getAppPackage: vi.fn(() => 'com.algorand.perawallet'),
    })

    test('useDeviceInfoService resolves the registered DeviceInfoService from the container', () => {
        const dummy = createMockDeviceInfoService()

        container.register(DeviceInfoServiceContainerKey, { useValue: dummy })

        const svc = useDeviceInfoService()
        expect(svc).toBe(dummy)

        svc.initializeDeviceInfo()
        expect(dummy.initializeDeviceInfo).toHaveBeenCalledTimes(1)
    })

    test('getAppName returns the application name', () => {
        const dummy = createMockDeviceInfoService()
        container.register(DeviceInfoServiceContainerKey, { useValue: dummy })

        const svc = useDeviceInfoService()
        expect(svc.getAppName()).toBe('Pera Wallet')
        expect(dummy.getAppName).toHaveBeenCalledTimes(1)
    })

    test('getAppId returns the app store ID', () => {
        const dummy = createMockDeviceInfoService()
        container.register(DeviceInfoServiceContainerKey, { useValue: dummy })

        const svc = useDeviceInfoService()
        expect(svc.getAppId()).toBe('1459898525')
        expect(dummy.getAppId).toHaveBeenCalledTimes(1)
    })

    test('getAppPackage returns the bundle/package identifier', () => {
        const dummy = createMockDeviceInfoService()
        container.register(DeviceInfoServiceContainerKey, { useValue: dummy })

        const svc = useDeviceInfoService()
        expect(svc.getAppPackage()).toBe('com.algorand.perawallet')
        expect(dummy.getAppPackage).toHaveBeenCalledTimes(1)
    })

    test('getAppBuild returns the build number', () => {
        const dummy = createMockDeviceInfoService()
        container.register(DeviceInfoServiceContainerKey, { useValue: dummy })

        const svc = useDeviceInfoService()
        expect(svc.getAppBuild()).toBe('123')
        expect(dummy.getAppBuild).toHaveBeenCalledTimes(1)
    })

    test('getAppVersion returns the version string', () => {
        const dummy = createMockDeviceInfoService()
        container.register(DeviceInfoServiceContainerKey, { useValue: dummy })

        const svc = useDeviceInfoService()
        expect(svc.getAppVersion()).toBe('1.0.0')
        expect(dummy.getAppVersion).toHaveBeenCalledTimes(1)
    })

    test('getDeviceID returns a promise with the device ID', async () => {
        const dummy = createMockDeviceInfoService()
        container.register(DeviceInfoServiceContainerKey, { useValue: dummy })

        const svc = useDeviceInfoService()
        const deviceId = await svc.getDeviceID()
        expect(deviceId).toBe('test-device-id')
        expect(dummy.getDeviceID).toHaveBeenCalledTimes(1)
    })

    test('getDeviceModel returns the device model', () => {
        const dummy = createMockDeviceInfoService()
        container.register(DeviceInfoServiceContainerKey, { useValue: dummy })

        const svc = useDeviceInfoService()
        expect(svc.getDeviceModel()).toBe('iPhone 15 Pro')
        expect(dummy.getDeviceModel).toHaveBeenCalledTimes(1)
    })

    test('getDevicePlatform returns the platform type', () => {
        const dummy = createMockDeviceInfoService()
        container.register(DeviceInfoServiceContainerKey, { useValue: dummy })

        const svc = useDeviceInfoService()
        expect(svc.getDevicePlatform()).toBe('ios')
        expect(dummy.getDevicePlatform).toHaveBeenCalledTimes(1)
    })

    test('getDeviceLocale returns the device locale', () => {
        const dummy = createMockDeviceInfoService()
        container.register(DeviceInfoServiceContainerKey, { useValue: dummy })

        const svc = useDeviceInfoService()
        expect(svc.getDeviceLocale()).toBe('en-US')
        expect(dummy.getDeviceLocale).toHaveBeenCalledTimes(1)
    })

    test('getDeviceCountry returns the device country code', () => {
        const dummy = createMockDeviceInfoService()
        container.register(DeviceInfoServiceContainerKey, { useValue: dummy })

        const svc = useDeviceInfoService()
        expect(svc.getDeviceCountry()).toBe('US')
        expect(dummy.getDeviceCountry).toHaveBeenCalledTimes(1)
    })

    test('getUserAgent returns the user agent string', () => {
        const dummy = createMockDeviceInfoService()
        container.register(DeviceInfoServiceContainerKey, { useValue: dummy })

        const svc = useDeviceInfoService()
        expect(svc.getUserAgent()).toBe('Pera/1.0.0 (iOS; iPhone 15 Pro)')
        expect(dummy.getUserAgent).toHaveBeenCalledTimes(1)
    })
})
