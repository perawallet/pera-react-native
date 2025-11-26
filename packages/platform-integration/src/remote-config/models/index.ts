export const RemoteConfigKeys = {
    welcome_message: 'welcome_message',
} as const

export type RemoteConfigKey =
    (typeof RemoteConfigKeys)[keyof typeof RemoteConfigKeys]

export const RemoteConfigDefaults: Record<
    RemoteConfigKey,
    string | boolean | number
> = {
    welcome_message: 'Hello',
}

export interface RemoteConfigService {
    initializeRemoteConfig(): void
    getStringValue(key: RemoteConfigKey, fallback?: string): string
    getBooleanValue(key: RemoteConfigKey, fallback?: boolean): boolean
    getNumberValue(key: RemoteConfigKey, fallback?: number): number
}
