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

import { describe, expect, it } from 'vitest'
import type { PeraAsset } from '@perawallet/wallet-core-assets'
import { nftThumbnailUrlOf } from '../nftThumbnailUrlOf'

const assetWith = (
    peraMetadata: Partial<NonNullable<PeraAsset['peraMetadata']>>,
): PeraAsset => ({ assetId: '1', decimals: 0, peraMetadata }) as PeraAsset

describe('nftThumbnailUrlOf', () => {
    it('prefers the collectible image over the logo', () => {
        expect(
            nftThumbnailUrlOf(
                assetWith({
                    logo: 'https://logo.example/a.png',
                    collectible: { primaryImage: 'https://nft.example/a.png' },
                }),
            ),
        ).toBe('https://nft.example/a.png')
    })

    it('falls back to the logo', () => {
        expect(
            nftThumbnailUrlOf(
                assetWith({ logo: 'https://logo.example/a.png' }),
            ),
        ).toBe('https://logo.example/a.png')
    })

    it('is undefined with no asset or no image', () => {
        expect(nftThumbnailUrlOf(null)).toBeUndefined()
        expect(nftThumbnailUrlOf(assetWith({}))).toBeUndefined()
    })
})
