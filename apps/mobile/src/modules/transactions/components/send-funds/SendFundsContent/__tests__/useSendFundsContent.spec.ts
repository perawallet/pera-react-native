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

import { act, renderHook } from '@test-utils/render'
import {
    afterEach,
    describe,
    it,
    expect,
    beforeEach,
    vi,
    type Mock,
} from 'vitest'
import { Decimal } from 'decimal.js'
import {
    isUniqueCollectible,
    useAssetsQuery,
} from '@perawallet/wallet-core-assets'
import { useSendFundsStore } from '@modules/transactions/hooks'
import { useSendFundsContent } from '../useSendFundsContent'

const mockDismiss = vi.fn()

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useSelectedAccount: vi.fn(() => ({ address: 'SENDERADDR' })),
    useAccountChainId: () => 'algorand',
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useAssetsQuery: vi.fn(() => ({
        data: new Map([['123', { assetId: '123', name: 'TestToken' }]]),
        isFetched: true,
    })),
    isUniqueCollectible: vi.fn(() => false),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheetResult: vi.fn(() => ({ dismiss: mockDismiss })),
}))

const ASA_ID = '123'
const ASA = { chainId: 'algorand', assetId: ASA_ID } as const
const OLD_RECIPIENT = 'OLDRECIPIENTADDR'

describe('useSendFundsContent — state carried between sheet sessions', () => {
    beforeEach(() => {
        useSendFundsStore.getState().reset()
        vi.clearAllMocks()
    })

    it('clears the previous send when the sheet is torn down without onFinished', () => {
        const first = renderHook(() => useSendFundsContent(ASA))
        useSendFundsStore.getState().setDestination(OLD_RECIPIENT)
        useSendFundsStore.getState().setAmount(new Decimal(42))

        expect(useSendFundsStore.getState().canSelectAsset).toBe(false)
        expect(useSendFundsStore.getState().selectedAsset).toEqual(ASA)

        // A backdrop press unmounts the sheet (dismiss -> remove) without
        // running `onFinished`, which only the close/done buttons are wired to.
        first.unmount()
        renderHook(() => useSendFundsContent(undefined))

        const state = useSendFundsStore.getState()
        expect(state.canSelectAsset).toBe(true)
        expect(state.selectedAsset).toBeUndefined()
        expect(state.destination).toBeUndefined()
        expect(state.amount).toBeUndefined()
    })

    // Deeplink/account-actions callers populate the store and then open the
    // sheet, so the cleanup must be teardown-only — a mount-time reset would
    // silently swallow the deeplink's destination.
    it('keeps prefill written before the sheet opened', () => {
        useSendFundsStore.getState().setDestination(OLD_RECIPIENT)
        useSendFundsStore.getState().setAmount(new Decimal(42))

        renderHook(() => useSendFundsContent(undefined))

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
        ;(isUniqueCollectible as Mock).mockReturnValue(false)
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

        const { result, rerender } = renderHook(() => useSendFundsContent(ASA))

        // Holding closed so SendFundsRoutes doesn't mount its navigator (and lock
        // in an initial route) off an unresolved asset.
        expect(result.current.isReady).toBe(false)
        // The asset-scoped store setup still runs deterministically.
        expect(useSendFundsStore.getState().canSelectAsset).toBe(false)
        expect(useSendFundsStore.getState().selectedAsset).toEqual(ASA)

        // Query settles.
        ;(useAssetsQuery as Mock).mockReturnValue({
            data: new Map([[ASA_ID, { assetId: ASA_ID, name: 'TestToken' }]]),
            isFetched: true,
        })
        rerender()

        expect(result.current.isReady).toBe(true)
    })

    it('does not prefill an amount for a non-collectible asset', () => {
        const { result } = renderHook(() => useSendFundsContent(ASA))

        expect(result.current.isReady).toBe(true)
        expect(useSendFundsStore.getState().amount).toBeUndefined()
    })

    it('returns the selected account', () => {
        const { result } = renderHook(() => useSendFundsContent(ASA))

        expect(result.current.selectedAccount).toEqual({
            address: 'SENDERADDR',
        })
    })

    it('leaves an asset already selected under the same ref untouched', () => {
        const existing = { chainId: 'algorand' as const, assetId: ASA_ID }
        useSendFundsStore.getState().setSelectedAsset(existing)
        useSendFundsStore.getState().setCanSelectAsset(false)

        renderHook(() => useSendFundsContent({ ...ASA }))

        expect(useSendFundsStore.getState().selectedAsset).toBe(existing)
    })

    it('registers handleFinished as the flow onFinished', () => {
        const { result } = renderHook(() => useSendFundsContent(ASA))

        expect(useSendFundsStore.getState().onFinished).toBe(
            result.current.handleFinished,
        )
    })

    it('reads the asset on its own chain and puts the send on it', () => {
        const token = { chainId: 'ethereum', assetId: '0xTOKEN' } as const

        renderHook(() => useSendFundsContent(token))

        expect(useAssetsQuery).toHaveBeenCalledWith(
            expect.objectContaining({ chainId: 'ethereum' }),
            ['0xTOKEN'],
        )
        expect(useSendFundsStore.getState().selectedAsset).toEqual(token)
    })
})

describe('useSendFundsContent — a collectible on another chain', () => {
    const NFT_ID = '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D/7'
    const NFT = { chainId: 'ethereum', assetId: NFT_ID } as const
    const nftAsset = (isUnique: boolean) => ({
        assetId: NFT_ID,
        decimals: 0,
        peraMetadata: { type: 'collectible', isUnique },
    })

    beforeEach(async () => {
        useSendFundsStore.getState().reset()
        vi.clearAllMocks()
        const actual = await vi.importActual<
            typeof import('@perawallet/wallet-core-assets')
        >('@perawallet/wallet-core-assets')
        ;(isUniqueCollectible as Mock).mockImplementation(
            actual.isUniqueCollectible,
        )
    })

    it('prefills 1 for a unique collectible, so the amount step is skipped', () => {
        ;(useAssetsQuery as Mock).mockReturnValue({
            data: new Map([[NFT_ID, nftAsset(true)]]),
            isFetched: true,
        })

        renderHook(() => useSendFundsContent(NFT))

        expect(useSendFundsStore.getState().amount?.toString()).toBe('1')
    })

    it('leaves the quantity of a non-unique collectible to the amount step', () => {
        ;(useAssetsQuery as Mock).mockReturnValue({
            data: new Map([[NFT_ID, nftAsset(false)]]),
            isFetched: true,
        })

        renderHook(() => useSendFundsContent(NFT))

        expect(useSendFundsStore.getState().amount).toBeUndefined()
    })
})

describe('useSendFundsContent — unique collectible prefill latch', () => {
    const NFT_1 = { chainId: 'algorand', assetId: 'nft-1' } as const
    let amountWrites = 0
    let unsubscribe: () => void

    beforeEach(() => {
        useSendFundsStore.getState().reset()
        vi.clearAllMocks()
        ;(isUniqueCollectible as Mock).mockReturnValue(true)
        // A fresh Map per render (as a refetch would produce) keeps the
        // prefill effect re-running, so only the latch stops a second write.
        ;(useAssetsQuery as Mock).mockImplementation(() => ({
            data: new Map([
                ['nft-1', { assetId: 'nft-1' }],
                ['nft-2', { assetId: 'nft-2' }],
            ]),
            isFetched: true,
        }))
        amountWrites = 0
        unsubscribe = useSendFundsStore.subscribe((state, prev) => {
            if (state.amount !== prev.amount) amountWrites += 1
        })
    })

    afterEach(() => {
        unsubscribe()
    })

    it('prefills the amount only once even when the effect re-runs', () => {
        const { rerender } = renderHook(() => useSendFundsContent(NFT_1))
        rerender()
        rerender()

        expect(amountWrites).toBe(1)
        expect(useSendFundsStore.getState().amount?.toString()).toBe('1')
    })

    it('prefills again after switching to a different unique collectible', () => {
        const { rerender } = renderHook(
            ({ assetId }: { assetId: string }) =>
                useSendFundsContent({ chainId: 'algorand', assetId }),
            { initialProps: { assetId: 'nft-1' } },
        )
        rerender({ assetId: 'nft-2' })

        expect(amountWrites).toBe(2)
    })

    it('re-prefills the same unique collectible after handleFinished clears the latch', () => {
        const { result, rerender } = renderHook(() =>
            useSendFundsContent(NFT_1),
        )

        act(() => {
            result.current.handleFinished()
        })
        rerender()

        expect(mockDismiss).toHaveBeenCalledTimes(1)
        expect(amountWrites).toBe(3)
        expect(useSendFundsStore.getState().amount?.toString()).toBe('1')
    })
})
