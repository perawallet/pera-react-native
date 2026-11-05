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
import { AnalyticsMetadataKey, SwapEvent } from '@analytics'
import { useSwapChainFilter } from '../useSwapChainFilter'

const { mockTrackEvent } = vi.hoisted(() => ({ mockTrackEvent: vi.fn() }))

vi.mock('@analytics', async importOriginal => ({
    ...(await importOriginal<typeof import('@analytics')>()),
    trackEvent: mockTrackEvent,
}))

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const
const TWO_CHAINS: ChainId[] = ['algorand', 'ethereum']

describe('useSwapChainFilter', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('offers no chips for one chain', () => {
        const { result } = renderHook(() =>
            useSwapChainFilter({
                chainIds: ['algorand'],
                scope: SCOPE,
                variant: 'from',
            }),
        )

        expect(result.current.chainOptions).toEqual([])
        expect(result.current.visibleChainIds).toEqual(['algorand'])
    })

    it('offers All, then each chain, with the variant in the test ids', () => {
        const { result } = renderHook(() =>
            useSwapChainFilter({
                chainIds: TWO_CHAINS,
                scope: SCOPE,
                variant: 'to',
            }),
        )

        expect(result.current.chainOptions.map(o => o.testID)).toEqual([
            'swap_to_chain_filter_all',
            'swap_to_chain_filter_algorand',
            'swap_to_chain_filter_ethereum',
        ])
        expect(result.current.selectedChainId).toBeNull()
        expect(result.current.visibleChainIds).toEqual(TWO_CHAINS)
    })

    it('narrows to the picked chain and reports it', () => {
        const { result } = renderHook(() =>
            useSwapChainFilter({
                chainIds: TWO_CHAINS,
                scope: SCOPE,
                variant: 'from',
            }),
        )

        act(() => result.current.handleSelectChain('ethereum'))

        expect(result.current.selectedChainId).toBe('ethereum')
        expect(result.current.visibleChainIds).toEqual(['ethereum'])
        expect(mockTrackEvent).toHaveBeenCalledWith(
            SwapEvent.SelectFromChainFilter,
            { [AnalyticsMetadataKey.ChainId]: 'ethereum' },
        )
    })

    it('reports the swap chain when All is picked', () => {
        const { result } = renderHook(() =>
            useSwapChainFilter({
                chainIds: TWO_CHAINS,
                scope: SCOPE,
                variant: 'to',
            }),
        )

        act(() => result.current.handleSelectChain(null))

        expect(mockTrackEvent).toHaveBeenCalledWith(
            SwapEvent.SelectToChainFilter,
            { [AnalyticsMetadataKey.ChainId]: 'algorand' },
        )
    })

    it('falls back to All when the picked chain leaves the list', () => {
        const { result, rerender } = renderHook(
            ({ chainIds }) =>
                useSwapChainFilter({ chainIds, scope: SCOPE, variant: 'from' }),
            { initialProps: { chainIds: TWO_CHAINS } },
        )
        act(() => result.current.handleSelectChain('ethereum'))

        rerender({ chainIds: ['algorand'] })

        expect(result.current.selectedChainId).toBeNull()
        expect(result.current.visibleChainIds).toEqual(['algorand'])
    })
})
