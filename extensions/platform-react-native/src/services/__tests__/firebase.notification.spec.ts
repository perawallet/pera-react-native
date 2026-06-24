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

import { describe, expect, it, vi } from 'vitest'

// The Firebase/notifee native modules ship untranspiled source that vitest
// cannot parse; mock them so importing the pure factory under test resolves.
vi.mock('@react-native-firebase/crashlytics', () => ({}))
vi.mock('@react-native-firebase/remote-config', () => ({}))
vi.mock('@react-native-firebase/messaging', () => ({}))
vi.mock('@react-native-firebase/analytics', () => ({}))
vi.mock('@notifee/react-native', () => ({ default: {} }))

import { androidForegroundNotification } from '../firebase'

describe('androidForegroundNotification', () => {
    it('uses the dedicated notification small icon and the given channel', () => {
        expect(androidForegroundNotification('default')).toEqual({
            channelId: 'default',
            smallIcon: 'ic_notification_small',
        })
    })
})
