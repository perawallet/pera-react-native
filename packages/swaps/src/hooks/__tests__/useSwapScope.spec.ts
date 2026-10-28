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

import { describe, expect, test, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useSwapSigningAccounts } from '../useSwapScope'

const mocks = vi.hoisted(() => ({
    accounts: [] as WalletAccount[],
    swapChainOf: vi.fn<(account: WalletAccount) => ChainId | undefined>(),
    signable: new Set<string>(),
    states: {} as Record<string, unknown>,
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useAllAccounts: () => mocks.accounts,
    useCapabilityChainResolver: () => mocks.swapChainOf,
    useAccountChainStateStore: (selector: (state: unknown) => unknown) =>
        selector({ states: mocks.states }),
    useAccountCapabilityScope: vi.fn(),
    useSelectedAccount: vi.fn(),
    canSignWith: (account: WalletAccount) => mocks.signable.has(account.id),
}))

const account = (id: string): WalletAccount => ({
    id,
    custody: { kind: 'local', seed: null },
    chains: { algorand: { address: id } },
})

describe('swaps/useSwapSigningAccounts', () => {
    beforeEach(() => {
        mocks.swapChainOf.mockReset()
        mocks.states = {}
    })

    test('keeps signers on a swap chain and drops watch and swap-less accounts', () => {
        const signer = account('signer')
        const watch = account('watch')
        const noSwapChain = account('no-swap-chain')
        mocks.accounts = [signer, watch, noSwapChain]
        mocks.signable = new Set(['signer', 'no-swap-chain'])
        mocks.swapChainOf.mockImplementation(held =>
            held.id === 'no-swap-chain' ? undefined : 'algorand',
        )

        const { result } = renderHook(() => useSwapSigningAccounts())

        expect(result.current).toEqual([signer])
    })

    test('is empty when no account is on a swap chain', () => {
        mocks.accounts = [account('a'), account('b')]
        mocks.signable = new Set(['a', 'b'])
        mocks.swapChainOf.mockReturnValue(undefined)

        const { result } = renderHook(() => useSwapSigningAccounts())

        expect(result.current).toEqual([])
    })

    test('recomputes when a chain-state slice changes', () => {
        mocks.accounts = [account('signer')]
        mocks.signable = new Set()
        mocks.swapChainOf.mockReturnValue('algorand')
        const { result, rerender } = renderHook(() => useSwapSigningAccounts())
        expect(result.current).toEqual([])

        mocks.signable = new Set(['signer'])
        rerender()
        expect(result.current).toEqual([])

        mocks.states = {}
        rerender()
        expect(result.current).toEqual(mocks.accounts)
    })
})
