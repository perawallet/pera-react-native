/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { vi } from 'vitest'

// Common native modules used in the app, stubbed with minimal implementations
vi.mock('@react-native-firebase/app', () => ({
    default: { app: vi.fn(() => ({})) },
}))

vi.mock('@react-native-firebase/crashlytics', () => ({
    getCrashlytics: () => ({
        setCrashlyticsCollectionEnabled: vi.fn(),
        recordError: vi.fn(),
        log: vi.fn(),
    }),
}))

vi.mock('@react-native-firebase/messaging', () => ({
    getMessaging: () => ({
        registerDeviceForRemoteMessages: vi.fn(),
        onMessage: vi.fn(() => vi.fn()),
        getToken: vi.fn(async () => 'token'),
    }),
}))

vi.mock('@react-native-firebase/remote-config', () => ({
    getRemoteConfig: () => ({
        setDefaults: vi.fn(async () => {}),
        fetchAndActivate: vi.fn(async () => true),
        setConfigSettings: vi.fn(),
        getValue: vi.fn(() => ({
            asString: () => '',
            asBoolean: () => false,
            asNumber: () => 0,
        })),
    }),
}))

vi.mock('@notifee/react-native', () => ({
    default: {
        requestPermission: vi.fn(async () => true),
        onForegroundEvent: vi.fn(() => vi.fn()),
    },
    AuthorizationStatus: 'AUTHORIZED',
    notifee: {
        requestPermission: vi.fn(),
        createChannel: vi.fn(),
        displayNotification: vi.fn(),
        onForegroundEvent: vi.fn(),
    },
}))
