import { container } from 'tsyringe'
import type { DevicePlatform } from './types'

export const DeviceInfoServiceContainerKey = 'DeviceInfoService'

export interface DeviceInfoService {
    initializeDeviceInfo(): void
    getDeviceID(): Promise<string>
    getDeviceModel(): string
    getDevicePlatform(): DevicePlatform
    getDeviceLocale(): string
    getUserAgent(): string
}

export const useDeviceInfoService = () =>
    container.resolve<DeviceInfoService>(DeviceInfoServiceContainerKey)
