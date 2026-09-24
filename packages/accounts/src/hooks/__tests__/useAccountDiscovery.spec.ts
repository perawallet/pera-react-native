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
import { renderHook, act } from '@testing-library/react'
import { useAccountDiscovery } from '../useAccountDiscovery'

const mockBaseDiscoverAccounts = vi.fn()
const mockBaseDiscoverRekeyedAccounts = vi.fn()

vi.mock('../../account-discovery', () => ({
    discoverAccounts: (...args: unknown[]) => mockBaseDiscoverAccounts(...args),
    discoverRekeyedAccounts: (...args: unknown[]) =>
        mockBaseDiscoverRekeyedAccounts(...args),
}))

vi.mock('@algorandfoundation/xhd-wallet-api', () => ({
    BIP32DerivationType: { Peikert: 9 },
}))

const kmsMock = vi.hoisted(() => ({
    getDerivedPublicKey: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    useKMS: () => kmsMock,
}))

describe('useAccountDiscovery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        kmsMock.getDerivedPublicKey.mockResolvedValue(
            new Uint8Array(32).fill(7),
        )
        mockBaseDiscoverAccounts.mockResolvedValue(['acc'])
        mockBaseDiscoverRekeyedAccounts.mockResolvedValue(['rekeyed'])
    })

    describe('discoverAccounts', () => {
        it('passes a getPublicKey callback that delegates to kms.getDerivedPublicKey', async () => {
            const { result } = renderHook(() => useAccountDiscovery())

            let discovered: unknown
            await act(async () => {
                discovered = await result.current.discoverAccounts({
                    walletKeyId: 'WALLET1',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    derivationType: 9 as any,
                    accountGapLimit: 3,
                    keyIndexGapLimit: 2,
                })
            })

            // Lazy: getDerivedPublicKey isn't invoked until the discovery
            // callback fires.
            expect(kmsMock.getDerivedPublicKey).not.toHaveBeenCalled()

            const baseCall = mockBaseDiscoverAccounts.mock.calls[0]?.[0]
            expect(baseCall).toMatchObject({
                walletKeyId: 'WALLET1',
                derivationType: 9,
                accountGapLimit: 3,
                keyIndexGapLimit: 2,
            })
            expect(typeof baseCall.getPublicKey).toBe('function')

            const pubKey = await baseCall.getPublicKey({
                account: 1,
                keyIndex: 0,
                derivationType: 9,
            })
            expect(kmsMock.getDerivedPublicKey).toHaveBeenCalledWith(
                'WALLET1',
                1,
                0,
                9,
            )
            expect(pubKey).toBeInstanceOf(Uint8Array)

            expect(discovered).toEqual(['acc'])
        })
    })

    describe('discoverRekeyedAccounts', () => {
        it('forwards the address list without touching key derivation', async () => {
            const { result } = renderHook(() => useAccountDiscovery())

            let discovered: unknown
            await act(async () => {
                discovered = await result.current.discoverRekeyedAccounts({
                    accountAddresses: ['A', 'B'],
                })
            })

            expect(kmsMock.getDerivedPublicKey).not.toHaveBeenCalled()
            expect(mockBaseDiscoverRekeyedAccounts).toHaveBeenCalledWith({
                accountAddresses: ['A', 'B'],
            })
            expect(discovered).toEqual(['rekeyed'])
        })
    })
})
