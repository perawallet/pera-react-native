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
import { renderHook } from '@testing-library/react'
import { MAX_WIDGET_NFTS } from '../../snapshot'
import { useWidgetNftCandidatesQuery } from '../useWidgetNftCandidatesQuery'

const mocks = vi.hoisted(() => ({ useHeldAssetDetailsQuery: vi.fn() }))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useHeldAssetDetailsQuery: mocks.useHeldAssetDetailsQuery,
}))

const SCOPE = { chainId: 'algorand', networkId: 'mainnet' } as never

const asset = (
    assetId: string,
    collectible: Record<string, unknown> | undefined,
) => ({
    assetId,
    name: `Asset ${assetId}`,
    peraMetadata: { collectible },
})

const heldAssets = (assets: unknown[] | undefined, isError = false) =>
    mocks.useHeldAssetDetailsQuery.mockReturnValue({ assets, isError })

const renderQuery = (addresses: string[], enabled = true) =>
    renderHook(() => useWidgetNftCandidatesQuery(addresses, SCOPE, enabled))

describe('useWidgetNftCandidatesQuery', () => {
    beforeEach(() => {
        mocks.useHeldAssetDetailsQuery.mockReset()
    })

    // Some collectibles have no image, so the lookup reads past the cap.
    it('asks for collectibles with headroom past the cap', () => {
        heldAssets(undefined)

        renderQuery(['A'])

        expect(mocks.useHeldAssetDetailsQuery).toHaveBeenCalledWith(
            ['A'],
            SCOPE,
            {
                kind: 'collectible',
                maxAssetIds: MAX_WIDGET_NFTS * 3,
                enabled: true,
            },
        )
    })

    it('maps assets with an image and skips those without', () => {
        heldAssets([
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

        expect(result.current.candidates).toEqual([
            {
                assetId: '1',
                title: 'Gif',
                collectionName: 'Coll',
                imageUrl: 'https://x/1.gif',
            },
        ])
    })

    it('falls back to an image preview and the asset name', () => {
        heldAssets([
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

        expect(result.current.candidates).toEqual([
            { assetId: '1', title: 'Asset 1', imageUrl: 'https://x/p.png' },
        ])
    })

    it('caps candidates at MAX_WIDGET_NFTS', () => {
        heldAssets(
            Array.from({ length: MAX_WIDGET_NFTS * 3 }, (_, i) =>
                asset(String(i + 1), { primaryImage: `https://x/${i}.png` }),
            ),
        )

        const { result } = renderQuery(['A'])

        expect(result.current.candidates).toHaveLength(MAX_WIDGET_NFTS)
    })

    it('stays undefined while loading or disabled', () => {
        heldAssets(undefined)

        expect(renderQuery(['A']).result.current.candidates).toBeUndefined()
        expect(
            renderQuery(['A'], false).result.current.candidates,
        ).toBeUndefined()
    })

    // An NFT failure must not hold back the price and portfolio widgets.
    it('reports no candidates when the read fails or there are no accounts', () => {
        heldAssets(undefined, true)
        expect(renderQuery(['A']).result.current.candidates).toEqual([])

        heldAssets(undefined)
        expect(renderQuery([]).result.current.candidates).toEqual([])
    })
})
