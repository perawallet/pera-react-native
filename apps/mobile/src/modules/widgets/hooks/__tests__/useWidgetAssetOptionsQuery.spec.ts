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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createQueryClientWrapper } from '@test-utils/render'
import { useWidgetAssetOptionsQuery } from '../useWidgetAssetOptionsQuery'

const mocks = vi.hoisted(() => ({
    getAccountHoldingsLite: vi.fn(),
    getAssetsByIds: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    getAccountHoldingsLite: mocks.getAccountHoldingsLite,
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    getAssetsByIds: mocks.getAssetsByIds,
    PeraAssetVerificationTier: { verified: 'verified' },
}))

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as never

const asset = (
    assetId: string,
    verificationTier: string,
    extra: Record<string, unknown> = {},
) => ({
    assetId,
    name: `Asset ${assetId}`,
    unitName: `A${assetId}`,
    peraMetadata: { verificationTier, ...extra },
})

const renderQuery = (addresses: string[], enabled = true) =>
    renderHook(() => useWidgetAssetOptionsQuery(addresses, SCOPE, enabled), {
        wrapper: createQueryClientWrapper(),
    })

describe('useWidgetAssetOptionsQuery', () => {
    beforeEach(() => {
        mocks.getAccountHoldingsLite.mockReset()
        mocks.getAssetsByIds.mockReset()
    })

    it('reads held fungible assets across accounts without NFTs or empty balances', async () => {
        mocks.getAccountHoldingsLite
            .mockResolvedValueOnce([{ assetId: '1' }, { assetId: '0' }])
            .mockResolvedValueOnce([{ assetId: '1' }, { assetId: '2' }])
        mocks.getAssetsByIds.mockResolvedValue([])

        renderQuery(['A', 'B'])

        await waitFor(() =>
            expect(mocks.getAssetsByIds).toHaveBeenCalledWith({
                assetIds: ['1', '2'],
                scope: SCOPE,
            }),
        )
        expect(mocks.getAccountHoldingsLite).toHaveBeenCalledWith({
            sources: [{ address: 'A', scope: SCOPE }],
            hideZeroBalance: true,
            hideNfts: true,
        })
    })

    // A spoofed "USDC" must never reach the home screen picker.
    it('offers only verified assets', async () => {
        mocks.getAccountHoldingsLite.mockResolvedValue([
            { assetId: '1' },
            { assetId: '2' },
            { assetId: '3' },
        ])
        mocks.getAssetsByIds.mockResolvedValue([
            asset('1', 'verified'),
            asset('2', 'unverified'),
            asset('3', 'suspicious'),
        ])

        const { result } = renderQuery(['A'])

        await waitFor(() => expect(result.current.options).toBeDefined())
        expect(result.current.options).toEqual([
            { assetId: '1', name: 'Asset 1', unitName: 'A1' },
        ])
    })

    it('skips collectibles that slipped past the NFT filter', async () => {
        mocks.getAccountHoldingsLite.mockResolvedValue([{ assetId: '1' }])
        mocks.getAssetsByIds.mockResolvedValue([
            asset('1', 'verified', { collectible: { title: 'Art' } }),
            asset('2', 'verified'),
        ])

        const { result } = renderQuery(['A'])

        await waitFor(() => expect(result.current.options).toBeDefined())
        expect(result.current.options?.map(option => option.assetId)).toEqual([
            '2',
        ])
    })

    it('reads nothing and stays undefined when disabled', () => {
        const { result } = renderQuery(['A'], false)

        expect(result.current.options).toBeUndefined()
        expect(mocks.getAccountHoldingsLite).not.toHaveBeenCalled()
    })

    it('reports no options when the read fails', async () => {
        mocks.getAccountHoldingsLite.mockRejectedValue(new Error('db'))

        const { result } = renderQuery(['A'])

        await waitFor(() => expect(result.current.options).toEqual([]))
    })
})
