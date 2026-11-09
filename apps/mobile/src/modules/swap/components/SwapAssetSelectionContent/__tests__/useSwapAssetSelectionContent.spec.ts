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
import type { AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'
import { useSwapAssetSelectionContent } from '../useSwapAssetSelectionContent'

const mockResolve = vi.hoisted(() => vi.fn())
const mockTrackEvent = vi.hoisted(() => vi.fn())

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: () => ({ resolve: mockResolve }),
}))

vi.mock('@analytics', async importOriginal => ({
    ...(await importOriginal<typeof import('@analytics')>()),
    trackEvent: mockTrackEvent,
}))

const ALGO_SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as const
const ETH_SCOPE = { chainId: 'ethereum', networkId: 'mainnet' } as const

const asset = { assetId: '31566704' } as AssetWithAccountBalance

describe('useSwapAssetSelectionContent', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('resolves a pick from the pay picker on the pay side', () => {
        const { result } = renderHook(() =>
            useSwapAssetSelectionContent('from'),
        )

        result.current.handleAssetSelected(asset, ALGO_SCOPE)

        expect(mockResolve).toHaveBeenCalledWith({
            assetId: '31566704',
            scope: ALGO_SCOPE,
            side: 'pay',
        })
    })

    it('resolves a pick from the receive picker on the receive side', () => {
        const { result } = renderHook(() => useSwapAssetSelectionContent('to'))

        result.current.handleAssetSelected(asset, ETH_SCOPE)

        expect(mockResolve).toHaveBeenCalledWith({
            assetId: '31566704',
            scope: ETH_SCOPE,
            side: 'receive',
        })
    })

    it('resolves a pay asset chosen from the receive picker on the pay side', () => {
        const { result } = renderHook(() => useSwapAssetSelectionContent('to'))

        result.current.handleSwitchPayAsset('0', ALGO_SCOPE)

        expect(mockResolve).toHaveBeenCalledWith({
            assetId: '0',
            scope: ALGO_SCOPE,
            side: 'pay',
        })
    })

    it('resolves a holding from the pay picker on the scope it lives on', () => {
        const { result } = renderHook(() =>
            useSwapAssetSelectionContent('from'),
        )

        result.current.handleFromAssetSelected({
            ...asset,
            scope: ETH_SCOPE,
        } as Parameters<typeof result.current.handleFromAssetSelected>[0])

        expect(mockResolve).toHaveBeenCalledWith(
            expect.objectContaining({ scope: ETH_SCOPE, side: 'pay' }),
        )
    })
})
