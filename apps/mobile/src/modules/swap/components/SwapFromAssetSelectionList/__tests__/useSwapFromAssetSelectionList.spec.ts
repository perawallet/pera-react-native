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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { useSwapFromAssetSelectionList } from '../useSwapFromAssetSelectionList'

let mockSourceChainIds: ChainId[] = []
vi.mock('../../../hooks/useSwapSourceChains', () => ({
    useSwapSourceChains: () => mockSourceChainIds,
}))

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const

describe('useSwapFromAssetSelectionList', () => {
    beforeEach(() => {
        mockSourceChainIds = ['algorand', 'ethereum']
    })

    it('lists every source chain and names each row on All', () => {
        const { result } = renderHook(() =>
            useSwapFromAssetSelectionList(SCOPE),
        )

        expect(result.current.visibleChainIds).toEqual(['algorand', 'ethereum'])
        expect(result.current.chainOptions).toHaveLength(3)
        expect(result.current.isChainShown).toBe(true)
    })

    it('stops naming rows once a chain is picked', () => {
        const { result } = renderHook(() =>
            useSwapFromAssetSelectionList(SCOPE),
        )

        act(() => result.current.handleSelectChain('ethereum'))

        expect(result.current.visibleChainIds).toEqual(['ethereum'])
        expect(result.current.isChainShown).toBe(false)
    })

    it('has no chips for an account on one chain', () => {
        mockSourceChainIds = ['algorand']

        const { result } = renderHook(() =>
            useSwapFromAssetSelectionList(SCOPE),
        )

        expect(result.current.chainOptions).toEqual([])
        expect(result.current.isChainShown).toBe(false)
    })

    it('holds the swap chain when the account cannot pay from it', () => {
        mockSourceChainIds = ['ethereum', 'base']

        const { result } = renderHook(() =>
            useSwapFromAssetSelectionList(SCOPE),
        )

        expect(result.current.visibleChainIds).toEqual(['algorand'])
        expect(result.current.chainOptions).toEqual([])
    })
})
