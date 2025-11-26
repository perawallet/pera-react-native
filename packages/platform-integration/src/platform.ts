import { container } from 'tsyringe'
import {
    CrashReportingServiceContainerKey,
    type CrashReportingService,
} from './reporting'
import {
    RemoteConfigServiceContainerKey,
    type RemoteConfigService,
} from './remote-config'
import {
    AnalyticsServiceContainerKey,
    type AnalyticsService,
} from './analytics'
import {
    KeyValueStorageServiceContainerKey,
    SecureStorageServiceContainerKey,
    type KeyValueStorageService,
    type SecureStorageService,
} from './storage'
import {
    NotificationServiceContainerKey,
    type NotificationService,
} from './push-notifications'
import { DeviceInfoServiceContainerKey, type DeviceInfoService } from './device'
import type { PlatformServices } from './models'

export const registerPlatformServices = async (platform: PlatformServices) => {
    container.register<KeyValueStorageService>(
        KeyValueStorageServiceContainerKey,
        { useValue: platform.keyValueStorage },
    )
    container.register<SecureStorageService>(SecureStorageServiceContainerKey, {
        useValue: platform.secureStorage,
    })
    container.register<RemoteConfigService>(RemoteConfigServiceContainerKey, {
        useValue: platform.remoteConfig,
    })
    container.register<AnalyticsService>(AnalyticsServiceContainerKey, {
        useValue: platform.analytics,
    })
    container.register<NotificationService>(NotificationServiceContainerKey, {
        useValue: platform.notification,
    })
    container.register<CrashReportingService>(
        CrashReportingServiceContainerKey,
        {
            useValue: platform.crashReporting,
        },
    )
    container.register<DeviceInfoService>(DeviceInfoServiceContainerKey, {
        useValue: platform.deviceInfo,
    })
}
