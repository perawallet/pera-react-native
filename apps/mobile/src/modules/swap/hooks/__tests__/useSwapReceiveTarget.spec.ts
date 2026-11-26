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

import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    accountChainOptions,
    canSignWith,
    useAllAccounts,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import type { Nullable } from '@perawallet/wallet-core-shared'
import { useSwapAccount, useSwapsStore } from '@perawallet/wallet-core-swaps'
import { useSwapReceiveTarget } from '../useSwapReceiveTarget'

const ALGO_SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const
const ETH_SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const
const BASE_SCOPE = { chainId: 'base', networkId: 'mainnet' } as const

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
    base: { address: '0xOTHER', keyPairId: 'k3' },
})

const store = { toAssetScope: null as Nullable<ChainScope> }

describe('useSwapReceiveTarget', () => {
    beforeEach(() => {
        store.toAssetScope = ETH_SCOPE
        vi.mocked(useSwapsStore).mockImplementation(((
            selector: (state: typeof store) => unknown,
        ) => selector(store)) as never)
        vi.mocked(useSwapAccount).mockReturnValue(SELECTED)
        vi.mocked(useAllAccounts).mockReturnValue([SELECTED, OTHER])
        vi.mocked(canSignWith).mockReturnValue(true)
        vi.mocked(accountChainOptions).mockReturnValue([
            { chainId: 'ethereum', isEnabled: true, address: '0xSELECTED' },
        ])
    })

    it("pays a cross-chain swap into the swap account's address on the destination chain", () => {
        const { result } = renderHook(() => useSwapReceiveTarget(ALGO_SCOPE))

        expect(result.current).toEqual({
            receiveScope: ETH_SCOPE,
            isCrossChain: true,
            receivingAddress: '0xSELECTED',
            shouldEnableReceiveChain: false,
        })
    })

    it('enables a destination chain the account is only eligible for', () => {
        store.toAssetScope = BASE_SCOPE
        vi.mocked(accountChainOptions).mockReturnValue([
            { chainId: 'base', isEnabled: false, address: '0xSELECTED' },
        ])

        const { result } = renderHook(() => useSwapReceiveTarget(ALGO_SCOPE))

        expect(result.current).toMatchObject({
            receivingAddress: '0xSELECTED',
            shouldEnableReceiveChain: true,
        })
    })

    it('never pays another account that holds the destination chain', () => {
        store.toAssetScope = BASE_SCOPE
        vi.mocked(accountChainOptions).mockReturnValue([])

        const { result } = renderHook(() => useSwapReceiveTarget(ALGO_SCOPE))

        expect(result.current).toMatchObject({
            receivingAddress: null,
            shouldEnableReceiveChain: false,
        })
    })

    it('receives into the swapper on its own scope', () => {
        store.toAssetScope = null

        const { result } = renderHook(() => useSwapReceiveTarget(ALGO_SCOPE))

        expect(result.current).toEqual({
            receiveScope: ALGO_SCOPE,
            isCrossChain: false,
            receivingAddress: 'ALGO_SELECTED',
            shouldEnableReceiveChain: false,
        })
    })

    it('has no address without a swap account', () => {
        vi.mocked(useSwapAccount).mockReturnValue(null)

        const { result } = renderHook(() => useSwapReceiveTarget(ALGO_SCOPE))

        expect(result.current.receivingAddress).toBeNull()
    })
})
