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
import {
    fakeAccountsChain,
    TESTNET_SCOPE,
} from '../../__tests__/fakeAccountsChain'

const mockBaseDiscoverAccounts = vi.fn()
const mockBaseDiscoverDelegatedAccounts = vi.fn()

vi.mock('../../account-discovery', () => ({
    discoverAccounts: (...args: unknown[]) => mockBaseDiscoverAccounts(...args),
    discoverDelegatedAccounts: (...args: unknown[]) =>
        mockBaseDiscoverDelegatedAccounts(...args),
}))

const delegation = vi.hoisted(() => ({ isAvailable: true }))
vi.mock('../useIsDelegationAvailable', () => ({
    useIsDelegationAvailable: () => delegation.isAvailable,
}))

describe('useAccountDiscovery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        delegation.isAvailable = true
        mockBaseDiscoverAccounts.mockResolvedValue(['acc'])
        mockBaseDiscoverDelegatedAccounts.mockResolvedValue(['delegated'])
    })

    describe('discoverAccounts', () => {
        it('passes a getPublicKey callback that derives through the registered key derivation', async () => {
            const { result } = renderHook(() =>
                useAccountDiscovery(TESTNET_SCOPE),
            )

            let discovered: unknown
            await act(async () => {
                discovered = await result.current.discoverAccounts({
                    walletKeyId: 'WALLET1',
                    accountGapLimit: 3,
                    keyIndexGapLimit: 2,
                })
            })

            // Lazy: nothing is derived until the discovery callback fires.
            const { deriveAccount } = fakeAccountsChain().derivation
            expect(deriveAccount).not.toHaveBeenCalled()

            const baseCall = mockBaseDiscoverAccounts.mock.calls[0]?.[0]
            expect(baseCall).toMatchObject({
                walletKeyId: 'WALLET1',
                accountGapLimit: 3,
                keyIndexGapLimit: 2,
                scope: TESTNET_SCOPE,
            })
            expect(typeof baseCall.getPublicKey).toBe('function')

            const pubKey = await baseCall.getPublicKey({
                account: 1,
                keyIndex: 0,
            })
            expect(deriveAccount).toHaveBeenCalledWith(
                expect.anything(),
                'WALLET1',
                1,
                0,
                { scheme: 'ed25519', networkId: 'testnet' },
            )
            expect(Array.from(pubKey)).toEqual([1, 0, 0xfa, 0xce])

            expect(discovered).toEqual(['acc'])
        })
    })

    describe('discoverDelegatedAccounts', () => {
        it('forwards the address list without touching key derivation', async () => {
            const { result } = renderHook(() =>
                useAccountDiscovery(TESTNET_SCOPE),
            )

            let discovered: unknown
            await act(async () => {
                discovered = await result.current.discoverDelegatedAccounts({
                    accountAddresses: ['A', 'B'],
                })
            })

            expect(
                fakeAccountsChain().derivation.deriveAccount,
            ).not.toHaveBeenCalled()
            expect(mockBaseDiscoverDelegatedAccounts).toHaveBeenCalledWith({
                accountAddresses: ['A', 'B'],
                scope: TESTNET_SCOPE,
            })
            expect(discovered).toEqual(['delegated'])
        })

        it('finds nothing, without scanning, while delegation is unavailable', async () => {
            delegation.isAvailable = false
            const { result } = renderHook(() =>
                useAccountDiscovery(TESTNET_SCOPE),
            )

            let discovered: unknown
            await act(async () => {
                discovered = await result.current.discoverDelegatedAccounts({
                    accountAddresses: ['A'],
                })
            })

            expect(discovered).toEqual([])
            expect(mockBaseDiscoverDelegatedAccounts).not.toHaveBeenCalled()
        })
    })
})
