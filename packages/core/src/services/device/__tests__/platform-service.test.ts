import { describe, test, expect, vi } from 'vitest'
import { container } from 'tsyringe'
import {
	DeviceInfoServiceContainerKey,
	DevicePlatforms,
	useDeviceInfoService,
	type DeviceInfoService,
} from '@services/device'

describe('services/device/platform-service', () => {
	test('useDeviceInfoService resolves the registered DeviceInfoService from the container', () => {
		const dummy: DeviceInfoService = {
			initializeDeviceInfo: vi.fn(),
			getDeviceID: vi.fn(() => Promise.resolve('id')),
			getDeviceModel: vi.fn(() => 'testModel'),
			getDevicePlatform: vi.fn(() => Promise.resolve(DevicePlatforms.web)),
			getDeviceLocale: vi.fn(() => 'testLanguage'),
		}

		container.register(DeviceInfoServiceContainerKey, { useValue: dummy })

		const svc = useDeviceInfoService()
		expect(svc).toBe(dummy)

		svc.initializeDeviceInfo()
		expect(dummy.initializeDeviceInfo).toHaveBeenCalledTimes(1)
	})
})
