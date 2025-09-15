import { container } from 'tsyringe'
import {
	CrashReportingServiceContainerKey,
	type CrashReportingService,
} from '../services/reporting'
import {
	RemoteConfigServiceContainerKey,
	type RemoteConfigService,
} from '../services/remote-config'
import {
	KeyValueStorageServiceContainerKey,
	SecureStorageServiceContainerKey,
	type KeyValueStorageService,
	type SecureStorageService,
} from '../services'
import {
	NotificationServiceContainerKey,
	type NotificationService,
} from '../services/notifications'

export interface PlatformServices {
	keyValueStorage: KeyValueStorageService
	secureStorage: SecureStorageService
	notification: NotificationService
	remoteConfig: RemoteConfigService
	crashReporting: CrashReportingService
}

export const registerPlatformServices = (platform: PlatformServices) => {
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
	container.register<NotificationService>(NotificationServiceContainerKey, {
		useValue: platform.notification,
	})
	container.register<CrashReportingService>(CrashReportingServiceContainerKey, {
		useValue: platform.crashReporting,
	})
}
