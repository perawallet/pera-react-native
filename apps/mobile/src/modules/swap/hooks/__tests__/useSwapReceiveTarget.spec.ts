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

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    canSignWith,
    useAllAccounts,
    useSelectedAccount,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type {
    ChainId,
    ChainScope,
} from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useSwapsStore } from '@perawallet/wallet-core-swaps'
import { useSwapReceiveTarget } from '../useSwapReceiveTarget'

const ALGO_SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const
const ETH_SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const

const account = (
    id: string,
    chains: WalletAccount['chains'],
): WalletAccount => ({
    id,
    name: '',
    custody: { kind: 'local', seed: null },
    chains,
})

const SELECTED = account('selected', {
    algorand: { address: 'ALGO_SELECTED', keyPairId: 'k1' },
    ethereum: { address: '0xSELECTED', keyPairId: 'k2' },
})
const OTHER = account('other', {
    ethereum: { address: '0xOTHER', keyPairId: 'k3' },
})
const ALGO_ONLY = account('algo-only', {
    algorand: { address: 'ALGO_ONLY', keyPairId: 'k4' },
})

const store = {
    toAssetScope: null as Nullable<ChainScope>,
    receivingAccountId: null as Nullable<string>,
    setReceivingAccountId: vi.fn(),
}

describe('useSwapReceiveTarget', () => {
    beforeEach(() => {
        store.toAssetScope = ETH_SCOPE
        store.receivingAccountId = null
        store.setReceivingAccountId.mockReset()
        vi.mocked(useSwapsStore).mockImplementation(((
            selector: (state: typeof store) => unknown,
        ) => selector(store)) as never)
        vi.mocked(useSelectedAccount).mockReturnValue(SELECTED)
        vi.mocked(useAllAccounts).mockReturnValue([SELECTED, OTHER, ALGO_ONLY])
        vi.mocked(canSignWith).mockImplementation(
            (candidate: WalletAccount, _accounts, chainId: ChainId) =>
                !!candidate.chains[chainId]?.keyPairId,
        )
    })

    it("defaults to the selected account's address on the destination chain", () => {
        const { result } = renderHook(() => useSwapReceiveTarget(ALGO_SCOPE))

        expect(result.current).toMatchObject({
            receiveScope: ETH_SCOPE,
            isCrossChain: true,
            receivingAccount: SELECTED,
            receivingAddress: '0xSELECTED',
        })
        expect(result.current.receivingAccounts).toEqual([SELECTED, OTHER])
    })

    it('uses the stored account while it can still receive there', () => {
        store.receivingAccountId = 'other'

        const { result } = renderHook(() => useSwapReceiveTarget(ALGO_SCOPE))

        expect(result.current.receivingAddress).toBe('0xOTHER')
    })

    it('falls back when the stored account can no longer receive there', () => {
        store.receivingAccountId = 'removed'
        vi.mocked(useSelectedAccount).mockReturnValue(ALGO_ONLY)

        const { result } = renderHook(() => useSwapReceiveTarget(ALGO_SCOPE))

        expect(result.current.receivingAccount).toBe(SELECTED)
        expect(result.current.receivingAddress).toBe('0xSELECTED')
    })

    it('receives into the swapper on its own scope', () => {
        store.toAssetScope = null

        const { result } = renderHook(() => useSwapReceiveTarget(ALGO_SCOPE))

        expect(result.current).toMatchObject({
            receiveScope: ALGO_SCOPE,
            isCrossChain: false,
            receivingAccount: SELECTED,
            receivingAddress: 'ALGO_SELECTED',
        })
    })

    it('remembers the account the user picks', () => {
        const { result } = renderHook(() => useSwapReceiveTarget(ALGO_SCOPE))

        act(() => result.current.selectReceivingAccount(OTHER))

        expect(store.setReceivingAccountId).toHaveBeenCalledWith('other')
    })
})
