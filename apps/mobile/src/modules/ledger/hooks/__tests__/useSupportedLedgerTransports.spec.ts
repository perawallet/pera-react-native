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

import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useSupportedLedgerTransports } from '../useSupportedLedgerTransports'

const { mockProviders } = vi.hoisted(() => ({
    mockProviders: [] as {
        transportType: string
        isSupported: () => Promise<boolean>
    }[],
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({
        hardwareWalletRegistry: {
            getProvidersByManufacturer: () => mockProviders,
        },
    }),
}))

describe('useSupportedLedgerTransports', () => {
    it('reports only the transports this platform supports, treating a throw as unsupported', async () => {
        mockProviders.splice(
            0,
            mockProviders.length,
            { transportType: 'ble', isSupported: () => Promise.resolve(true) },
            {
                transportType: 'usb',
                isSupported: () => Promise.reject(new Error('no WebHID')),
            },
        )

        const { result } = renderHook(() => useSupportedLedgerTransports())

        expect(result.current.isReady).toBe(false)
        await waitFor(() => expect(result.current.isReady).toBe(true))
        expect(result.current.supportedTransportTypes).toEqual(['ble'])
    })
})
