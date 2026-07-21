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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { Network } from '@perawallet/wallet-core-shared'

import { useDeviceStore } from '../../store'
import { useIsDeviceRegistrationPending } from '../useIsDeviceRegistrationPending'

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

type SeedDeviceStoreOptions = {
    deviceIDs?: Map<Network, string>
    pendingRegistrationNetworks?: Network[]
}

const seedDeviceStore = ({
    deviceIDs = new Map(),
    pendingRegistrationNetworks = [],
}: SeedDeviceStoreOptions): void => {
    useDeviceStore.setState({ deviceIDs, pendingRegistrationNetworks })
}

describe('device/hooks/useIsDeviceRegistrationPending', () => {
    beforeEach(() => {
        useDeviceStore.getState().resetState()
    })

    test('pending when the network has no device id', () => {
        seedDeviceStore({ deviceIDs: new Map() })
        const { result } = renderHook(() => useIsDeviceRegistrationPending())
        expect(result.current).toBe(true)
    })

    test('pending when the network is marked registration-pending', () => {
        seedDeviceStore({
            deviceIDs: new Map([['mainnet', 'DEV-1']]),
            pendingRegistrationNetworks: ['mainnet'],
        })
        const { result } = renderHook(() => useIsDeviceRegistrationPending())
        expect(result.current).toBe(true)
    })

    test('not pending when registered', () => {
        seedDeviceStore({ deviceIDs: new Map([['mainnet', 'DEV-1']]) })
        const { result } = renderHook(() => useIsDeviceRegistrationPending())
        expect(result.current).toBe(false)
    })
})
