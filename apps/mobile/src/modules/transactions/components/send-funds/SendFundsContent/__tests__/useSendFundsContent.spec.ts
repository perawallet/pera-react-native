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

import { renderHook } from '@test-utils/render'
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { Decimal } from 'decimal.js'
import {
    isCollectible,
    isPureNft,
    useAssetsQuery,
} from '@perawallet/wallet-core-assets'
import { useSendFundsStore } from '@modules/transactions/hooks'
import { useSendFundsContent } from '../useSendFundsContent'

const mockDismiss = vi.fn()

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: vi.fn(() => ({ address: 'SENDERADDR' })),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetsQuery: vi.fn(() => ({
        data: new Map([['123', { assetId: '123', name: 'TestToken' }]]),
        isFetched: true,
    })),
    isCollectible: vi.fn(() => false),
    isPureNft: vi.fn(() => false),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: vi.fn(() => ({ dismiss: mockDismiss })),
}))

const ASA_ID = '123'
const OLD_RECIPIENT = 'OLDRECIPIENTADDR'

describe('useSendFundsContent — state carried between sheet sessions', () => {
    beforeEach(() => {
        useSendFundsStore.getState().reset()
        vi.clearAllMocks()
    })

    it('clears the previous send when the sheet is torn down without onFinished', () => {
        // Arrange: a send started from asset details, part-filled by the user.
        const first = renderHook(() => useSendFundsContent(ASA_ID))
        useSendFundsStore.getState().setDestination(OLD_RECIPIENT)
        useSendFundsStore.getState().setAmount(new Decimal(42))

        expect(useSendFundsStore.getState().canSelectAsset).toBe(false)
        expect(useSendFundsStore.getState().selectedAssetId).toBe(ASA_ID)

        // Act: the sheet goes away without `onFinished` running — this is what a
        // backdrop press does (dismiss -> remove -> unmount), and `onFinished`
        // is only wired to the explicit close/done buttons.
        first.unmount()

        // Act: user taps the main Send button, which opens the sheet with no
        // asset preselected.
        renderHook(() => useSendFundsContent(undefined))

        // Assert: they should land on asset selection with nothing carried over.
        const state = useSendFundsStore.getState()
        expect(state.canSelectAsset).toBe(true)
        expect(state.selectedAssetId).toBeUndefined()
        expect(state.destination).toBeUndefined()
        expect(state.amount).toBeUndefined()
    })

    it('keeps prefill written before the sheet opened', () => {
        // Arrange: deeplink/account-actions callers populate the store and then
        // open the sheet, so the cleanup must be teardown-only — a mount-time
        // reset would silently swallow the deeplink's destination.
        useSendFundsStore.getState().setDestination(OLD_RECIPIENT)
        useSendFundsStore.getState().setAmount(new Decimal(42))

        // Act
        renderHook(() => useSendFundsContent(undefined))

        // Assert
        expect(useSendFundsStore.getState().destination).toBe(OLD_RECIPIENT)
        expect(useSendFundsStore.getState().amount?.toString()).toBe('42')
    })
})

describe('useSendFundsContent — deterministic initial route', () => {
    beforeEach(() => {
        useSendFundsStore.getState().reset()
        vi.clearAllMocks()

        // clearAllMocks wipes call history but keeps mockReturnValue overrides,
        // so re-seed the settled defaults every run to stop a per-test override
        // leaking into the next.
        ;(useAssetsQuery as Mock).mockReturnValue({
            data: new Map([[ASA_ID, { assetId: ASA_ID, name: 'TestToken' }]]),
            isFetched: true,
        })
        ;(isCollectible as Mock).mockReturnValue(false)
        ;(isPureNft as Mock).mockReturnValue(false)
    })

    it('is ready immediately when opened without a preselected asset', () => {
        const { result } = renderHook(() => useSendFundsContent(undefined))

        expect(result.current.isReady).toBe(true)
    })

    it('stays not-ready until the asset query settles, then reveals the flow', () => {
        // Cold cache: the asset query has not resolved yet.
        ;(useAssetsQuery as Mock).mockReturnValue({
            data: new Map(),
            isFetched: false,
        })

        const { result, rerender } = renderHook(() =>
            useSendFundsContent(ASA_ID),
        )

        // Holding closed so SendFundsRoutes doesn't mount its navigator (and lock
        // in an initial route) off an unresolved asset.
        expect(result.current.isReady).toBe(false)
        // The asset-scoped store setup still runs deterministically.
        expect(useSendFundsStore.getState().canSelectAsset).toBe(false)
        expect(useSendFundsStore.getState().selectedAssetId).toBe(ASA_ID)

        // Query settles.
        ;(useAssetsQuery as Mock).mockReturnValue({
            data: new Map([[ASA_ID, { assetId: ASA_ID, name: 'TestToken' }]]),
            isFetched: true,
        })
        rerender()

        expect(result.current.isReady).toBe(true)
    })

    it('prefills the amount to 1 for a pure NFT once the asset has settled', () => {
        ;(isCollectible as Mock).mockReturnValue(true)
        ;(isPureNft as Mock).mockReturnValue(true)

        const { result } = renderHook(() => useSendFundsContent(ASA_ID))

        expect(result.current.isReady).toBe(true)
        expect(useSendFundsStore.getState().amount?.toString()).toBe('1')
    })

    it('does not prefill an amount for a non-collectible asset', () => {
        const { result } = renderHook(() => useSendFundsContent(ASA_ID))

        expect(result.current.isReady).toBe(true)
        expect(useSendFundsStore.getState().amount).toBeUndefined()
    })
})
