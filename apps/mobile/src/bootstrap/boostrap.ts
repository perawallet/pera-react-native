/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { RNDeviceInfoStorageService } from '../platform/device'
import { RNFirebaseService } from '../platform/firebase'
import { RNKeyValueStorageService } from '../platform/key-value-storage'
import { RNSecureStorageService } from '../platform/secure-storage'
import {
    useCrashReportingService,
    useRemoteConfigService,
    useNotificationService,
    registerPlatformServices,
    useFcmToken,
    useAnalyticsService,
} from '@perawallet/core'

const firebaseService = new RNFirebaseService()
const platformServices = {
    analytics: firebaseService,
    crashReporting: firebaseService,
    notification: firebaseService,
    remoteConfig: firebaseService,
    secureStorage: new RNSecureStorageService(),
    keyValueStorage: new RNKeyValueStorageService(),
    deviceInfo: new RNDeviceInfoStorageService(),
}

registerPlatformServices(platformServices)

export const useBootstrapper = () => {
    const crashlyticsService = useCrashReportingService()
    const remoteConfigService = useRemoteConfigService()
    const notificationService = useNotificationService()
    const analyticsService = useAnalyticsService()
    const { setFcmToken } = useFcmToken()

    return async () => {
        const crashlyticsInit = crashlyticsService.initializeCrashReporting()
        const remoteConfigInit = remoteConfigService.initializeRemoteConfig()
        const analyticsInit = analyticsService.initializeAnalytics()

        await Promise.allSettled([crashlyticsInit, remoteConfigInit, analyticsInit])

        const notificationResults =
            await notificationService.initializeNotifications()

        setFcmToken(notificationResults.token || null)

        return platformServices
    }
}
