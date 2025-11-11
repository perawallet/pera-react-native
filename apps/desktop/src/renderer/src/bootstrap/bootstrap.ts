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

import {
  useCrashReportingService,
  useRemoteConfigService,
  useNotificationService,
  registerPlatformServices,
  useAppStore
} from '@perawallet/core'

// Mock implementations for desktop
class WebKeyValueStorageService {
  getItem(key: string): string | null {
    return localStorage.getItem(key)
  }
  setItem(key: string, value: string): void {
    localStorage.setItem(key, value)
  }
  removeItem(key: string): void {
    localStorage.removeItem(key)
  }
  setJSON<T>(key: string, value: T): void {
    this.setItem(key, JSON.stringify(value))
  }
  getJSON<T>(key: string): T | null {
    const item = this.getItem(key)
    return item ? JSON.parse(item) : null
  }
}

class WebSecureStorageService {
  getItem(key: string): Promise<string | null> {
    return Promise.resolve(localStorage.getItem(key))
  }
  setItem(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value)
    return Promise.resolve()
  }
  removeItem(key: string): Promise<void> {
    localStorage.removeItem(key)
    return Promise.resolve()
  }
  authenticate(): Promise<boolean> {
    return Promise.resolve(true)
  }
}

class WebDeviceInfoService {
  initializeDeviceInfo(): void {
    // No-op
  }
  getDeviceID(): Promise<string> {
    return Promise.resolve('desktop-device-id')
  }
  getDeviceModel(): string {
    return 'Desktop'
  }
  getDevicePlatform(): 'ios' | 'android' | 'web' {
    return 'web'
  }
  getDeviceLocale(): string {
    return navigator.language || 'en-US'
  }
  getUserAgent(): string {
    return navigator.userAgent
  }
  getAppVersion(): string {
    return '1.0.0'
  }
}

class WebNotificationService {
  initializeNotifications(): Promise<{ token?: string; unsubscribe: () => void }> {
    return Promise.resolve({ unsubscribe: () => {} })
  }
}

class WebRemoteConfigService {
  initializeRemoteConfig(): void {
    // No-op
  }
  getStringValue(_: string, fallback?: string): string {
    return fallback || ''
  }
  getBooleanValue(_: string, fallback?: boolean): boolean {
    return fallback || false
  }
  getNumberValue(_: string, fallback?: number): number {
    return fallback || 0
  }
}

class WebCrashReportingService {
  initializeCrashReporting(): void {
    // No-op
  }
  recordNonFatalError(error: unknown): void {
    console.error('Non-fatal error:', error)
  }
}

const platformServices = {
  keyValueStorage: new WebKeyValueStorageService(),
  secureStorage: new WebSecureStorageService(),
  deviceInfo: new WebDeviceInfoService(),
  notification: new WebNotificationService(),
  remoteConfig: new WebRemoteConfigService(),
  crashReporting: new WebCrashReportingService()
}

registerPlatformServices(platformServices)

export const useBootstrapper = () => {
  const crashlyticsService = useCrashReportingService()
  const remoteConfigService = useRemoteConfigService()
  const notificationService = useNotificationService()

  const setFcmToken = useAppStore((state) => {
    return state.setFcmToken
  })

  return async () => {
    const crashlyticsInit = crashlyticsService.initializeCrashReporting()
    const remoteConfigInit = remoteConfigService.initializeRemoteConfig()

    await Promise.allSettled([crashlyticsInit, remoteConfigInit])

    const notificationResults = await notificationService.initializeNotifications()

    setFcmToken(notificationResults.token || null)

    return platformServices
  }
}
