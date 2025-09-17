import { container } from 'tsyringe'
import type { DevicePlatform } from './types'

export const DeviceInfoServiceContainerKey = 'DeviceInfoService'

export interface DeviceInfoService {
	initializeDeviceInfo(): void
	getDeviceID(): Promise<string>
	getDeviceModel(): string
	getDevicePlatform(): Promise<DevicePlatform>
}

export const useDeviceInfoService = () =>
	container.resolve<DeviceInfoService>(DeviceInfoServiceContainerKey)
