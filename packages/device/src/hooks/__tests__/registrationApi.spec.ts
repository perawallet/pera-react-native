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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import { isDeviceRegistrationV4Enabled } from '../registrationApi'

const mocks = vi.hoisted(() => ({ remote: undefined as boolean | undefined }))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        remoteConfig: {
            getBooleanValue: (_key: string, fallback?: boolean) =>
                mocks.remote ?? fallback,
        },
        deviceInfo: { getDevicePlatform: () => 'ios' },
        keyValueStorage: {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
        },
    }),
}))

describe('isDeviceRegistrationV4Enabled', () => {
    afterEach(() => {
        mocks.remote = undefined
        useRemoteConfigStore.getState().resetState()
    })

    it('is off until remote config turns it on', () => {
        expect(isDeviceRegistrationV4Enabled()).toBe(false)

        mocks.remote = true

        expect(isDeviceRegistrationV4Enabled()).toBe(true)
    })

    it('follows a developer override', () => {
        useRemoteConfigStore
            .getState()
            .setConfigOverride('enable_device_registration_v4', true)

        expect(isDeviceRegistrationV4Enabled()).toBe(true)
    })
})
