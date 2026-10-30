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
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import { useAssetActions } from '../useAssetActions'

const mocks = vi.hoisted(() => ({
    replace: vi.fn(),
    copyToClipboard: vi.fn(),
    showToast: vi.fn(),
    requestBottomSheet: vi.fn(),
}))

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ replace: mocks.replace }),
}))

vi.mock('@hooks/useClipboard', () => ({
    useClipboard: () => ({ copyToClipboard: mocks.copyToClipboard }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mocks.showToast }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mocks.requestBottomSheet }),
}))

vi.mock('@modules/transactions', () => ({
    useSendFunds: () => ({
        setSelectedAsset: vi.fn(),
        setCanSelectAsset: vi.fn(),
    }),
    useReceiveFunds: () => ({
        setSelectedAccount: vi.fn(),
        setCanSelectAccount: vi.fn(),
        setChainId: vi.fn(),
    }),
}))

vi.mock('@modules/transactions/routes', () => ({
    SendFundsContent: () => null,
    ReceiveFundsContent: () => null,
    SEND_FUNDS_SHEET_ID: 'send_funds',
}))

const asset = { assetId: '31566704' } as PeraAsset

describe('useAssetActions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('copies the account address and says so', () => {
        const { result } = renderHook(() =>
            useAssetActions({
                asset,
                chainId: 'algorand',
                account: {
                    chains: { algorand: { address: 'ADDRESS' } },
                },
            } as never),
        )

        act(() => result.current.handleCopyAddress())

        expect(mocks.copyToClipboard).toHaveBeenCalledWith('ADDRESS')
        expect(mocks.showToast).toHaveBeenCalled()
    })

    it('opens the swap tab with the asset as the output', () => {
        const { result } = renderHook(() =>
            useAssetActions({
                asset,
                chainId: 'algorand',
                account: null,
            }),
        )

        act(() => result.current.handleSwap())

        expect(mocks.replace).toHaveBeenCalledWith(
            'TabBar',
            expect.objectContaining({ screen: 'Swap' }),
        )
    })
})
