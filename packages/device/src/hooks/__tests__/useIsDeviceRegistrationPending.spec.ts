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

// @vitest-environment jsdom
import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type {
    ChainScopeKey,
    WalletMode,
} from '@perawallet/wallet-core-chain-contract'

import { useDeviceStore } from '../../store'
import { useIsDeviceRegistrationPending } from '../useIsDeviceRegistrationPending'

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useWalletDeployment: () => 'live',
}))

const LIVE_KEY = 'algorand/mainnet' as ChainScopeKey

type SeedDeviceStoreOptions = {
    deviceIDs?: Map<ChainScopeKey, string>
    pendingRegistrationDeployments?: WalletMode[]
}

const seedDeviceStore = ({
    deviceIDs = new Map(),
    pendingRegistrationDeployments = [],
}: SeedDeviceStoreOptions): void => {
    useDeviceStore.setState({ deviceIDs, pendingRegistrationDeployments })
}

describe('device/hooks/useIsDeviceRegistrationPending', () => {
    beforeEach(() => {
        useDeviceStore.getState().resetState()
    })

    test('pending when the deployment has no device id', () => {
        seedDeviceStore({ deviceIDs: new Map() })
        const { result } = renderHook(() => useIsDeviceRegistrationPending())
        expect(result.current).toBe(true)
    })

    test('pending when the deployment is marked registration-pending', () => {
        seedDeviceStore({
            deviceIDs: new Map([[LIVE_KEY, 'DEV-1']]),
            pendingRegistrationDeployments: ['live'],
        })
        const { result } = renderHook(() => useIsDeviceRegistrationPending())
        expect(result.current).toBe(true)
    })

    test('not pending when registered', () => {
        seedDeviceStore({
            deviceIDs: new Map([[LIVE_KEY, 'DEV-1']]),
        })
        const { result } = renderHook(() => useIsDeviceRegistrationPending())
        expect(result.current).toBe(false)
    })
})
