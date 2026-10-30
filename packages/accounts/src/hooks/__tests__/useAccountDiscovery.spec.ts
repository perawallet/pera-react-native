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
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAccountDiscovery } from '../useAccountDiscovery'
import {
    fakeAccountsChain,
    TESTNET_SCOPE,
} from '../../__tests__/fakeAccountsChain'

const mockBaseDiscoverDelegatedAccounts = vi.fn()

vi.mock('../../account-discovery', () => ({
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
        mockBaseDiscoverDelegatedAccounts.mockResolvedValue(['delegated'])
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
