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
import { act, renderHook } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import { ALGO_ASSET_ID } from '@perawallet/wallet-core-shared'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import type { AssetWithAccountBalance } from '@perawallet/wallet-core-accounts'
import { useAssetActionButtons } from '../useAssetActionButtons'

const mockReplace = vi.fn()
const mockRequestBottomSheet = vi.fn()
const mockShowToast = vi.fn()
const mockCopyToClipboard = vi.fn()
const mockSetSelectedAssetId = vi.fn()
const mockSetCanSelectAsset = vi.fn()
const mockTrackEvent = vi.fn()
const mockCanSignWith = vi.fn(() => true)

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ replace: mockReplace }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mockRequestBottomSheet }),
}))

vi.mock('@modules/transactions/components/send-funds/SendFundsContent', () => ({
    SendFundsContent: () => null,
}))

vi.mock(
    '@modules/transactions/components/receive-funds/ReceiveFundsContent',
    () => ({ ReceiveFundsContent: () => null }),
)

vi.mock('@modules/transactions/hooks', () => ({
    useSendFunds: () => ({
        setSelectedAssetId: mockSetSelectedAssetId,
        setCanSelectAsset: mockSetCanSelectAsset,
    }),
}))

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mockShowToast }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@analytics', () => ({
    trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
    AssetDetailsEvent: {
        Send: 'send',
        Receive: 'receive',
        SwapAlgo: 'swap_algo',
    },
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const actual = (await importOriginal()) as Record<string, unknown>
    return {
        ...actual,
        useSelectedAccount: () => ({ address: 'ACCOUNT_ADDRESS' }),
        useCanSignWith: () => mockCanSignWith(),
    }
})

const ASSET_ID = '31566704'

const asset = {
    assetId: ASSET_ID,
    name: 'USDC',
    decimals: 6,
    totalSupply: new Decimal(1000),
    creator: { address: 'CREATOR' },
} as PeraAsset

const holding = (isFrozen: boolean) =>
    ({
        assetId: ASSET_ID,
        amount: new Decimal(10),
        algoValue: new Decimal(0),
        isFrozen,
    }) as AssetWithAccountBalance

const render = (isFrozen: boolean) =>
    renderHook(() =>
        useAssetActionButtons({ asset, assetHolding: holding(isFrozen) }),
    )

describe('useAssetActionButtons', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockCanSignWith.mockReturnValue(true)
    })

    describe('an unfrozen holding', () => {
        it('opens the send sheet and preselects the asset', () => {
            const { result } = render(false)

            act(() => {
                result.current.handleSend()
            })

            expect(result.current.isFrozen).toBe(false)
            expect(mockRequestBottomSheet).toHaveBeenCalled()
            expect(mockSetSelectedAssetId).toHaveBeenCalledWith(ASSET_ID)
        })

        it('navigates to swap with the asset as the output leg', () => {
            const { result } = render(false)

            act(() => {
                result.current.handleSwap()
            })

            expect(mockReplace).toHaveBeenCalledWith('TabBar', {
                screen: 'Swap',
                params: { assetInId: ALGO_ASSET_ID, assetOutId: ASSET_ID },
            })
        })
    })

    describe('a frozen holding', () => {
        it('blocks send and explains why instead of opening the sheet', () => {
            const { result } = render(true)

            act(() => {
                result.current.handleSend()
            })

            expect(result.current.isFrozen).toBe(true)
            expect(mockRequestBottomSheet).not.toHaveBeenCalled()
            expect(mockSetSelectedAssetId).not.toHaveBeenCalled()
            expect(mockShowToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'asset_details.frozen_notice.title',
                    type: 'warning',
                }),
            )
        })

        it('blocks swap, which would also be rejected on chain', () => {
            const { result } = render(true)

            act(() => {
                result.current.handleSwap()
            })

            expect(mockReplace).not.toHaveBeenCalled()
            expect(mockShowToast).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'asset_details.frozen_notice.title',
                }),
            )
        })

        it('still allows receive, which needs no balance to move', () => {
            const { result } = render(true)

            act(() => {
                result.current.handleReceive()
            })

            expect(mockRequestBottomSheet).toHaveBeenCalled()
            expect(mockShowToast).not.toHaveBeenCalled()
        })
    })

    it('reports read-only for an account that cannot sign', () => {
        mockCanSignWith.mockReturnValue(false)

        const { result } = render(false)

        expect(result.current.isReadOnly).toBe(true)
    })
})
