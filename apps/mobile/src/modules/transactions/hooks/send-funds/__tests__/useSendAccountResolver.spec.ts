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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { resolveSendAccount } from '../resolveSendAccount'
import { useSendAccountResolver } from '../useSendAccountResolver'

const { unsignable, mockRequestByType } = vi.hoisted(() => ({
    unsignable: new Set<string>(),
    mockRequestByType: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    canSignWith: (account: WalletAccount) => !unsignable.has(account.id),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetStore: () => ({ requestByType: mockRequestByType }),
}))

const accountOn = (id: string, chainId: string): WalletAccount =>
    ({
        id,
        name: id,
        custody: { kind: 'local', seed: null },
        chains: { [chainId]: { address: `${id}-address`, keyPairId: id } },
    }) as WalletAccount

const ALGO = accountOn('algo', 'algorand')
const ETH_A = accountOn('eth-a', 'ethereum')
const ETH_B = accountOn('eth-b', 'ethereum')
const REGISTERED = ['algorand', 'ethereum'] as const

const resolveOn = (
    chainId: 'algorand' | 'ethereum',
    accounts: WalletAccount[],
    selectedAccountId: string | null = null,
) =>
    resolveSendAccount({
        accounts,
        selectedAccountId,
        chainId,
        registeredChainIds: REGISTERED,
    })

describe('resolveSendAccount', () => {
    beforeEach(() => {
        unsignable.clear()
    })

    it('sends from the selected account when it is on the chain and can sign', () => {
        expect(resolveOn('ethereum', [ETH_A, ETH_B], 'eth-b')).toEqual({
            kind: 'selected',
            account: ETH_B,
        })
    })

    it('passes over a selected account on another chain', () => {
        expect(resolveOn('ethereum', [ALGO, ETH_A], 'algo')).toEqual({
            kind: 'single',
            account: ETH_A,
        })
    })

    it('passes over a selected account that cannot sign', () => {
        unsignable.add('eth-b')

        expect(resolveOn('ethereum', [ETH_A, ETH_B], 'eth-b')).toEqual({
            kind: 'single',
            account: ETH_A,
        })
    })

    it('asks which account when several on the chain can send', () => {
        expect(resolveOn('ethereum', [ALGO, ETH_A, ETH_B], 'algo')).toEqual({
            kind: 'picker',
            accounts: [ETH_A, ETH_B],
        })
    })

    it('finds none when no account on the chain can send', () => {
        unsignable.add('eth-a')

        expect(resolveOn('ethereum', [ALGO, ETH_A], 'algo')).toEqual({
            kind: 'none',
        })
    })
})

describe('useSendAccountResolver', () => {
    beforeEach(() => {
        unsignable.clear()
        mockRequestByType.mockReset()
        useAccountsStore.setState({
            accounts: [ALGO, ETH_A, ETH_B],
            selectedAccountId: 'algo',
        })
    })

    it('resolves against the accounts stored at call time', () => {
        const { result } = renderHook(() => useSendAccountResolver())

        act(() => {
            useAccountsStore.setState({ selectedAccountId: 'eth-a' })
        })

        expect(result.current.resolve('ethereum')).toEqual({
            kind: 'selected',
            account: ETH_A,
        })
    })

    it('picks through the sender sheet and returns the chosen account', async () => {
        mockRequestByType.mockResolvedValue('eth-b')
        const { result } = renderHook(() => useSendAccountResolver())

        const picked = await result.current.pick('ethereum', [ETH_A, ETH_B])

        expect(mockRequestByType).toHaveBeenCalledWith(
            'send-account-selection',
            { chainId: 'ethereum', accountIds: ['eth-a', 'eth-b'] },
            expect.anything(),
        )
        expect(picked).toBe(ETH_B)
    })

    it('returns no account when the sheet is dismissed', async () => {
        mockRequestByType.mockResolvedValue(undefined)
        const { result } = renderHook(() => useSendAccountResolver())

        expect(await result.current.pick('ethereum', [ETH_A, ETH_B])).toBe(
            undefined,
        )
    })
})
