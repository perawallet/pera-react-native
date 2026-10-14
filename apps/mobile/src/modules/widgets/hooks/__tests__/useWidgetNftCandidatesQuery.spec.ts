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
import { MAX_WIDGET_NFTS } from '../../snapshot'
import { useWidgetNftCandidatesQuery } from '../useWidgetNftCandidatesQuery'

const mocks = vi.hoisted(() => ({
    getAccountCollectiblesLite: vi.fn(),
    getAssetsByIds: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    getAccountCollectiblesLite: mocks.getAccountCollectiblesLite,
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    getAssetsByIds: mocks.getAssetsByIds,
}))

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as never

const asset = (
    assetId: string,
    collectible: Record<string, unknown> | undefined,
) => ({
    assetId,
    name: `Asset ${assetId}`,
    collectible,
})

const renderQuery = (addresses: string[], enabled = true) =>
    renderHook(() => useWidgetNftCandidatesQuery(addresses, SCOPE, enabled), {
        wrapper: createQueryClientWrapper(),
    })

describe('useWidgetNftCandidatesQuery', () => {
    beforeEach(() => {
        mocks.getAccountCollectiblesLite.mockReset()
        mocks.getAssetsByIds.mockReset()
    })

    it('dedupes held collectibles across accounts', async () => {
        mocks.getAccountCollectiblesLite
            .mockResolvedValueOnce([{ assetId: '1' }, { assetId: '2' }])
            .mockResolvedValueOnce([{ assetId: '2' }, { assetId: '3' }])
        mocks.getAssetsByIds.mockResolvedValue([])

        renderQuery(['A', 'B'])

        await waitFor(() =>
            expect(mocks.getAssetsByIds).toHaveBeenCalledWith({
                assetIds: ['1', '2', '3'],
                scope: SCOPE,
            }),
        )
        expect(mocks.getAccountCollectiblesLite).toHaveBeenCalledWith({
            accountAddress: 'A',
            scope: SCOPE,
            includeZeroBalance: false,
        })
    })

    it('maps assets with an image and skips those without', async () => {
        mocks.getAccountCollectiblesLite.mockResolvedValue([
            { assetId: '1' },
            { assetId: '2' },
        ])
        mocks.getAssetsByIds.mockResolvedValue([
            asset('1', {
                title: 'Gif',
                primaryImage: 'https://x/1.gif',
                collection: { name: 'Coll' },
            }),
            asset('2', {
                title: 'Song',
                media: [{ type: 'audio', extension: 'mp3' }],
            }),
        ])

        const { result } = renderQuery(['A'])

        await waitFor(() => expect(result.current.candidates).toBeDefined())
        expect(result.current.candidates).toEqual([
            {
                assetId: '1',
                title: 'Gif',
                collectionName: 'Coll',
                imageUrl: 'https://x/1.gif',
            },
        ])
    })

    it('falls back to an image preview and the asset name', async () => {
        mocks.getAccountCollectiblesLite.mockResolvedValue([{ assetId: '1' }])
        mocks.getAssetsByIds.mockResolvedValue([
            asset('1', {
                media: [
                    {
                        type: 'image',
                        previewUrl: 'https://x/p.png',
                        extension: 'png',
                    },
                ],
            }),
        ])

        const { result } = renderQuery(['A'])

        await waitFor(() => expect(result.current.candidates).toBeDefined())
        expect(result.current.candidates).toEqual([
            { assetId: '1', title: 'Asset 1', imageUrl: 'https://x/p.png' },
        ])
    })

    it('caps candidates at MAX_WIDGET_NFTS', async () => {
        const ids = Array.from({ length: MAX_WIDGET_NFTS * 3 }, (_, i) =>
            String(i + 1),
        )
        mocks.getAccountCollectiblesLite.mockResolvedValue(
            ids.map(assetId => ({ assetId })),
        )
        mocks.getAssetsByIds.mockImplementation(
            async ({ assetIds }: { assetIds: string[] }) =>
                assetIds.map(id =>
                    asset(id, { primaryImage: `https://x/${id}.png` }),
                ),
        )

        const { result } = renderQuery(['A'])

        await waitFor(() => expect(result.current.candidates).toBeDefined())
        expect(result.current.candidates).toHaveLength(MAX_WIDGET_NFTS)
    })

    it('reads nothing and stays undefined when disabled', () => {
        const { result } = renderQuery(['A'], false)

        expect(result.current.candidates).toBeUndefined()
        expect(mocks.getAccountCollectiblesLite).not.toHaveBeenCalled()
    })

    it('stays undefined when the read fails', async () => {
        mocks.getAccountCollectiblesLite.mockRejectedValue(new Error('db'))

        const { result } = renderQuery(['A'])

        await waitFor(() =>
            expect(mocks.getAccountCollectiblesLite).toHaveBeenCalled(),
        )
        expect(result.current.candidates).toBeUndefined()
    })
})
