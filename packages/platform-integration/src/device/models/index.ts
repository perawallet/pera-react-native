import type { Network } from '@perawallet/wallet-core-shared'

export type DeviceApplication = 'pera' | 'pera-beta' | 'fifa'

export interface DeviceRequest {
    id?: string
    push_token?: string
    platform: DevicePlatform
    application?: DeviceApplication
    model?: string
    locale?: string
    accounts: string[]
}

export interface DeviceResponse {
    id?: string
    push_token?: string
    platform: DevicePlatform
    application?: DeviceApplication
    model?: string
    locale?: string
}

export const DevicePlatforms = {
    ios: 'ios',
    android: 'android',
    web: 'web',
} as const

export type DevicePlatform =
    (typeof DevicePlatforms)[keyof typeof DevicePlatforms]

export interface DeviceInfoService {
    initializeDeviceInfo(): void
    getDeviceID(): Promise<string>
    getDeviceModel(): string
    getDevicePlatform(): DevicePlatform
    getDeviceLocale(): string
    getUserAgent(): string
    getAppVersion(): string
}

export type DeviceState = {
    fcmToken: string | null
    deviceIDs: Map<Network, string | null>
    network: Network
    setFcmToken: (token: string | null) => void
    setDeviceID: (network: Network, id: string | null) => void
    setNetwork: (network: Network) => void
}
