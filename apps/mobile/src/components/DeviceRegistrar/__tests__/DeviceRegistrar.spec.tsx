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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, renderHook } from '@test-utils/render'
import { useDeviceRegistration } from '@perawallet/wallet-core-device'
import { DeviceRegistrar } from '../DeviceRegistrar'

const mockRegistrations = [{ address: 'ADDRESS_1' }]

vi.mock('@perawallet/wallet-core-device', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-device')
    >()),
    useDeviceRegistration: vi.fn(),
}))
vi.mock('@hooks/useDeviceAccountRegistrations', () => ({
    useDeviceAccountRegistrations: () => mockRegistrations,
}))

describe('DeviceRegistrar', () => {
    beforeEach(() => {
        vi.mocked(useDeviceRegistration).mockClear()
    })

    it('registers the device accounts with no retry edge by default', () => {
        render(<DeviceRegistrar />)

        expect(useDeviceRegistration).toHaveBeenCalledWith(mockRegistrations, {
            subscribeToRetryEdge: undefined,
        })
    })

    it('forwards the retry edge subscription', () => {
        const subscribeToRetryEdge = vi.fn(() => () => undefined)

        render(<DeviceRegistrar subscribeToRetryEdge={subscribeToRetryEdge} />)

        expect(useDeviceRegistration).toHaveBeenCalledWith(mockRegistrations, {
            subscribeToRetryEdge,
        })
    })

    it('renders nothing', () => {
        const { result } = renderHook(() => DeviceRegistrar({}))

        expect(result.current).toBeNull()
    })
})
