import type { AnalyticsService } from './analytics'
import type { DeviceInfoService } from './device'
import type { NotificationService } from './push-notifications'
import type { RemoteConfigService } from './remote-config'
import type { CrashReportingService } from './reporting'
import type { KeyValueStorageService, SecureStorageService } from './storage'

export interface PlatformServices {
    keyValueStorage: KeyValueStorageService
    secureStorage: SecureStorageService
    notification: NotificationService
    remoteConfig: RemoteConfigService
    analytics: AnalyticsService
    crashReporting: CrashReportingService
    deviceInfo: DeviceInfoService
}
