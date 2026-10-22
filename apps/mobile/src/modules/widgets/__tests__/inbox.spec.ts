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

import { describe, expect, it } from 'vitest'
import { resolveInboxFeed } from '../inbox'

const resolve = (
    overrides: Partial<Parameters<typeof resolveInboxFeed>[0]> = {},
) =>
    resolveInboxFeed({
        isAvailable: true,
        isPrivacyMode: false,
        deviceId: 'device-1',
        addresses: ['A'],
        accountNames: [{ address: 'A', name: 'Main' }],
        notificationsBackendUrl: 'https://api.test',
        notificationsDeviceId: 'device-2',
        ...overrides,
    })

describe('resolveInboxFeed', () => {
    it('shares what the widgets need to fetch the inbox and notifications', () => {
        expect(resolve()).toEqual({
            deviceId: 'device-1',
            addresses: ['A'],
            accountNames: [{ address: 'A', name: 'Main' }],
            notifications: {
                backendUrl: 'https://api.test',
                deviceId: 'device-2',
            },
        })
    })

    it.each([
        ['privacy mode', { isPrivacyMode: true }],
        ['the inbox switched off', { isAvailable: false }],
        ['no device yet', { deviceId: null }],
        ['no accounts', { addresses: [] }],
    ])('shares nothing with %s', (_label, overrides) => {
        expect(resolve(overrides)).toBeNull()
    })

    it('still shares the inbox where notifications have no backend', () => {
        expect(
            resolve({ notificationsBackendUrl: '' })?.notifications,
        ).toBeNull()
        expect(
            resolve({ notificationsDeviceId: null })?.notifications,
        ).toBeNull()
    })
})
