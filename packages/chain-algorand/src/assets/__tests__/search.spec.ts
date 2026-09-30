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

const searchAssetsMock = vi.hoisted(() => vi.fn())

vi.mock('../api/search-endpoints', () => ({ searchAssets: searchAssetsMock }))

import { extractCursor, searchAssetPage } from '../search'

const apiResult = (assetId: number) => ({
    asset_id: assetId,
    name: `Asset ${assetId}`,
    unit_name: `A${assetId}`,
    logo: null,
    verification_tier: 'verified',
    usd_value: '1.00',
    type: 'standard_asset',
    collectible: null,
})

describe('extractCursor', () => {
    it('reads the cursor param from the next url', () => {
        expect(
            extractCursor(
                'https://api.example.com/v1/assets/search/?cursor=abc123',
            ),
        ).toBe('abc123')
    })

    it.each([
        ['a missing url', null],
        ['a malformed url', 'not a url'],
        [
            'a url without a cursor param',
            'https://api.example.com/v1/assets/search/?limit=25',
        ],
    ])('is undefined for %s', (_label, next) => {
        expect(extractCursor(next)).toBeUndefined()
    })
})

describe('searchAssetPage', () => {
    beforeEach(() => {
        searchAssetsMock.mockReset()
    })

    it('maps results and the next cursor, and forwards the search params', async () => {
        searchAssetsMock.mockResolvedValue({
            results: [apiResult(123)],
            next: 'https://api.example.com/v1/assets/search/?cursor=CURSOR_TOKEN',
        })

        const page = await searchAssetPage({
            query: 'usdc',
            network: 'mainnet',
            cursor: 'PREV',
            hasCollectible: true,
        })

        expect(searchAssetsMock).toHaveBeenCalledWith({
            query: 'usdc',
            network: 'mainnet',
            cursor: 'PREV',
            hasCollectible: true,
        })
        expect(page.nextCursor).toBe('CURSOR_TOKEN')
        expect(page.results).toEqual([
            expect.objectContaining({
                assetId: '123',
                name: 'Asset 123',
                unitName: 'A123',
                peraMetadata: expect.objectContaining({
                    verificationTier: 'verified',
                }),
            }),
        ])
    })

    it('maps collectible fields', async () => {
        searchAssetsMock.mockResolvedValue({
            results: [
                {
                    ...apiResult(42),
                    type: 'collectible',
                    collectible: {
                        title: 'Pera #42',
                        primary_image: 'https://img/42.png',
                        collection: { name: 'Pera Collection' },
                    },
                },
            ],
            next: null,
        })

        const page = await searchAssetPage({
            query: 'pera',
            network: 'mainnet',
        })

        expect(page.nextCursor).toBeUndefined()
        expect(page.results[0].peraMetadata).toEqual(
            expect.objectContaining({
                type: 'collectible',
                collectible: {
                    title: 'Pera #42',
                    primaryImage: 'https://img/42.png',
                    collection: { name: 'Pera Collection' },
                },
            }),
        )
    })
})
