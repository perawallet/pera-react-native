import { container } from "tsyringe";
import { CrashReportingServiceContainerKey, NotificationServiceContainerKey, RemoteConfigServiceContainerKey, type CrashReportingService, type RemoteConfigService } from "../services/configuration";
import { KeyValueStorageServiceContainerKey, SecureStorageServiceContainerKey, type KeyValueStorageService, type NotificationService, type SecureStorageService } from "../services";

export interface PlatformServices {
    keyValueStorage: KeyValueStorageService
    secureStorage: SecureStorageService
    notification: NotificationService
    remoteConfig: RemoteConfigService
    crashReporting: CrashReportingService
}

export const registerPlatformServices = (platform: PlatformServices) => {
  container.register<KeyValueStorageService>(KeyValueStorageServiceContainerKey, { useValue: platform.keyValueStorage })
  container.register<SecureStorageService>(SecureStorageServiceContainerKey, { useValue: platform.secureStorage })
  container.register<RemoteConfigService>(RemoteConfigServiceContainerKey, { useValue: platform.remoteConfig })
  container.register<NotificationService>(NotificationServiceContainerKey, { useValue: platform.notification })
  container.register<CrashReportingService>(CrashReportingServiceContainerKey, { useValue: platform.crashReporting })
}
