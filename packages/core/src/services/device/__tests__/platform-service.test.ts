import { describe, test, expect, vi } from 'vitest'
import { container } from 'tsyringe'
import {
    DeviceInfoServiceContainerKey,
    DevicePlatforms,
    useDeviceInfoService,
    type DeviceInfoService,
} from '@services/device'

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
            getAppVersion: vi.fn(() => '1.0.0-test')
        }

        container.register(DeviceInfoServiceContainerKey, { useValue: dummy })

        const svc = useDeviceInfoService()
        expect(svc).toBe(dummy)

        svc.initializeDeviceInfo()
        expect(dummy.initializeDeviceInfo).toHaveBeenCalledTimes(1)
    })
})
