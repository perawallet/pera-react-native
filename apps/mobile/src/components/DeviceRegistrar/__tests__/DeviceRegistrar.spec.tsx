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

import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from '@test-utils/render'
import { DeviceRegistrar } from '../DeviceRegistrar'

const mocks = vi.hoisted(() => ({
    useDeviceRegistration: vi.fn(),
    registrations: [
        {
            address: 'ADDRESS',
            accountType: 'standard',
            receiveNotifications: true,
        },
    ],
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceRegistration: mocks.useDeviceRegistration,
}))
vi.mock('@hooks/useDeviceAccountRegistrations', () => ({
    useDeviceAccountRegistrations: () => mocks.registrations,
}))

describe('DeviceRegistrar', () => {
    it('registers the device with the current account registrations', () => {
        render(<DeviceRegistrar />)

        expect(mocks.useDeviceRegistration).toHaveBeenCalledWith(
            mocks.registrations,
        )
    })
})
