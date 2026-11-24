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
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'
import { useSwapAccountNames } from '../useSwapAccountNames'

const ALGO = { chainId: 'algorand', networkId: 'mainnet' } as const
const ETH = { chainId: 'ethereum', networkId: 'mainnet' } as const

const mocks = vi.hoisted(() => ({ addresses: [] as unknown[] }))

vi.mock('../useSwapAccountsAddresses', () => ({
    useSwapAccountsAddresses: () => mocks.addresses,
}))
vi.mock('@perawallet/wallet-core-accounts', () => ({
    getAccountDisplayName: (account: { name: string }, chainId: string) =>
        `${account.name}@${chainId}`,
}))

const account = (id: string) => ({ id, name: id }) as unknown as WalletAccount

describe('swaps/useSwapAccountNames', () => {
    beforeEach(() => {
        mocks.addresses = []
    })

    test('names each account on its first swap chain', () => {
        const accounts = [account('one'), account('two')]
        mocks.addresses = [
            { scope: ETH, address: '0x1', accountId: 'one', isOnDevice: true },
            { scope: ALGO, address: 'A1', accountId: 'one', isOnDevice: true },
            { scope: ALGO, address: 'A2', accountId: 'two', isOnDevice: true },
        ]

        const { result } = renderHook(() => useSwapAccountNames(accounts))

        expect(result.current.names).toEqual([
            { accountId: 'one', name: 'one@ethereum' },
            { accountId: 'two', name: 'two@algorand' },
        ])
    })

    test('leaves out an account with no swap address and is multi-account from two', () => {
        const accounts = [account('one'), account('two'), account('none')]
        mocks.addresses = [
            { scope: ALGO, address: 'A1', accountId: 'one', isOnDevice: true },
        ]

        const { result, rerender } = renderHook(() =>
            useSwapAccountNames(accounts),
        )
        expect(result.current.names.map(entry => entry.accountId)).toEqual([
            'one',
        ])
        expect(result.current.isMultiAccount).toBe(false)

        mocks.addresses = [
            { scope: ALGO, address: 'A1', accountId: 'one', isOnDevice: true },
            { scope: ALGO, address: 'A2', accountId: 'two', isOnDevice: true },
        ]
        rerender()

        expect(result.current.isMultiAccount).toBe(true)
    })
})
