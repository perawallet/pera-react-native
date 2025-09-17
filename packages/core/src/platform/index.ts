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
import {
	DeviceInfoServiceContainerKey,
	type DeviceInfoService,
} from '../services/device/platform-service'

export interface PlatformServices {
	keyValueStorage: KeyValueStorageService
	secureStorage: SecureStorageService
	notification: NotificationService
	remoteConfig: RemoteConfigService
	crashReporting: CrashReportingService
	deviceInfo: DeviceInfoService
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
	container.register<DeviceInfoService>(DeviceInfoServiceContainerKey, {
		useValue: platform.deviceInfo,
	})
}
