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
import { settleInboxTokens } from '@perawallet/wallet-core-accounts'
import type { AssetInboxRequest } from '@perawallet/wallet-core-transactions'
import type { InboxRequestRow } from '../inboxRequestRow'
import { useResolveSelectedRequests } from '../useResolveSelectedRequests'

const ALGORAND = { chainId: 'algorand', networkId: 'mainnet' } as const
const BASE = { chainId: 'base', networkId: 'mainnet' } as const

const mocks = vi.hoisted(() => ({
    push: vi.fn(),
    showToast: vi.fn(),
    errorToast: vi.fn(),
    request: vi.fn(),
    setAccountAddress: vi.fn(),
    setAssetRequests: vi.fn(),
    onConfirm: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    settleInboxTokens: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    useNativeAsset: () => ({ unitName: 'ALGO' }),
}))

vi.mock('@modules/transactions/hooks', () => ({
    useClaimAssets: () => ({
        setAccountAddress: mocks.setAccountAddress,
        setAssetRequests: mocks.setAssetRequests,
    }),
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({ push: mocks.push }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        showToast: mocks.showToast,
        errorToast: mocks.errorToast,
    }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: mocks.request }),
}))

const claimRequest = (flags: Partial<AssetInboxRequest> = {}) =>
    ({
        asset: { assetId: '77' },
        insufficientNativeForClaiming: false,
        insufficientNativeForRejecting: false,
        shouldUseFundsBeforeClaiming: false,
        shouldUseFundsBeforeRejecting: false,
        ...flags,
    }) as AssetInboxRequest

const affordable = claimRequest()
const unaffordableClaim = claimRequest({ insufficientNativeForClaiming: true })
const BACKEND = [affordable, unaffordableClaim]

const ROWS = [
    { kind: 'header', key: 'h', chainId: 'algorand' },
    {
        kind: 'claim',
        key: 'c0',
        scope: ALGORAND,
        request: affordable,
        index: 0,
    },
    {
        kind: 'claim',
        key: 'c1',
        scope: ALGORAND,
        request: unaffordableClaim,
        index: 1,
    },
    {
        kind: 'token',
        key: 't0',
        scope: BASE,
        address: '0xabc',
        asset: { assetId: '0xb' },
    },
] as unknown as InboxRequestRow[]

const render = (selected: string[]) =>
    renderHook(() =>
        useResolveSelectedRequests({
            rows: ROWS,
            selectedKeys: new Set(selected),
            backendRequests: BACKEND,
            backendScope: ALGORAND,
            backendAddress: 'ALGO_ADDR',
            onConfirm: mocks.onConfirm,
        }),
    )

const sheetMessage = () =>
    mocks.request.mock.calls[0]![0].contents.props.message as string

describe('useResolveSelectedRequests', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('settles selected tokens at once and sends affordable claims to bulk processing, skipping the rest', async () => {
        mocks.request.mockResolvedValueOnce(true)
        const { result } = render(['c0', 'c1', 't0'])

        await act(() => result.current('claim'))

        expect(sheetMessage()).toContain(
            'asset_inbox.requests.bulk_skipped_note',
        )
        expect(mocks.onConfirm).toHaveBeenCalled()
        expect(settleInboxTokens).toHaveBeenCalledWith(
            [{ address: '0xabc', scope: BASE, assetId: '0xb' }],
            true,
        )
        expect(mocks.setAccountAddress).toHaveBeenCalledWith('ALGO_ADDR')
        expect(mocks.setAssetRequests).toHaveBeenCalledWith(BACKEND)
        expect(mocks.push).toHaveBeenCalledWith('Messages', {
            screen: 'BulkClaimProcessing',
            params: { mode: 'claim', assetIndexes: [0], scope: ALGORAND },
        })
    })

    it('rejects a claim that is only unaffordable to claim, and says rejecting is permanent', async () => {
        mocks.request.mockResolvedValueOnce(true)
        const { result } = render(['c1'])

        await act(() => result.current('reject'))

        expect(sheetMessage()).toContain(
            'asset_inbox.requests.bulk_reject_irreversible',
        )
        expect(mocks.push).toHaveBeenCalledWith('Messages', {
            screen: 'BulkClaimProcessing',
            params: { mode: 'reject', assetIndexes: [1], scope: ALGORAND },
        })
    })

    it('settles tokens alone without opening bulk processing', async () => {
        mocks.request.mockResolvedValueOnce(true)
        const { result } = render(['t0'])

        await act(() => result.current('reject'))

        expect(settleInboxTokens).toHaveBeenCalledWith(
            [{ address: '0xabc', scope: BASE, assetId: '0xb' }],
            false,
        )
        expect(mocks.push).not.toHaveBeenCalled()
        expect(mocks.showToast).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'success' }),
        )
    })

    it('warns instead of asking when nothing selected can be afforded', async () => {
        const { result } = render(['c1'])

        await act(() => result.current('claim'))

        expect(mocks.request).not.toHaveBeenCalled()
        expect(mocks.errorToast).toHaveBeenCalledWith(
            'messages.claim.insufficient_native_title',
            'messages.claim.insufficient_native_claim',
        )
    })

    it('changes nothing when the sheet is dismissed', async () => {
        mocks.request.mockResolvedValueOnce(false)
        const { result } = render(['c0', 't0'])

        await act(() => result.current('claim'))

        expect(mocks.onConfirm).not.toHaveBeenCalled()
        expect(settleInboxTokens).not.toHaveBeenCalled()
        expect(mocks.push).not.toHaveBeenCalled()
    })

    it('warns that claims share the minimum balance when more than one needs a transaction', async () => {
        mocks.request.mockResolvedValueOnce(false)
        const second = {
            ...ROWS[1],
            key: 'c2',
            index: 2,
        } as unknown as InboxRequestRow
        const { result } = renderHook(() =>
            useResolveSelectedRequests({
                rows: [...ROWS, second],
                selectedKeys: new Set(['c0', 'c2']),
                backendRequests: BACKEND,
                backendScope: ALGORAND,
                backendAddress: 'ALGO_ADDR',
                onConfirm: mocks.onConfirm,
            }),
        )

        await act(() => result.current('claim'))

        expect(sheetMessage()).toContain(
            'asset_inbox.requests.bulk_min_balance_note',
        )
    })
})
