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
import type { ScopedAssetSearchResult } from '@perawallet/wallet-core-assets'
import {
    isCollectibleResult,
    isRelevantSearchResult,
    rankSearchAssets,
} from '../rankSearchAssets'

const result = (
    name: string,
    overrides: {
        unitName?: string
        tier?: 'verified' | 'unverified' | 'suspicious'
        type?: 'standard_asset' | 'collectible'
        chainId?: string
    } = {},
): ScopedAssetSearchResult =>
    ({
        scope: {
            chainId: overrides.chainId ?? 'algorand',
            networkId: 'mainnet',
        },
        asset: {
            assetId: name,
            name,
            unitName: overrides.unitName,
            peraMetadata: {
                verificationTier: overrides.tier ?? 'unverified',
                type: overrides.type ?? 'standard_asset',
            },
        },
    }) as ScopedAssetSearchResult

const names = (results: ScopedAssetSearchResult[]) =>
    results.map(r => r.asset.name)

describe('rankSearchAssets', () => {
    it('puts a verified token above the unverified lookalikes found before it', () => {
        // The search answers chain by chain, so the real token arrives last.
        const ranked = rankSearchAssets(
            [
                result('Uniswap#0', { type: 'collectible' }),
                result('Uniswap#0 Collection'),
                result('uniswap.algo', {
                    unitName: 'NFD',
                    type: 'collectible',
                }),
                result('Uniswap', {
                    unitName: 'UNI',
                    tier: 'verified',
                    chainId: 'ethereum',
                }),
            ],
            'uniswap',
        )

        expect(names(ranked)).toEqual([
            'Uniswap',
            'Uniswap#0 Collection',
            'Uniswap#0',
            'uniswap.algo',
        ])
    })

    it('ranks verified, then unverified, then suspicious, with collectibles last', () => {
        const ranked = rankSearchAssets(
            [
                result('nft', { type: 'collectible', tier: 'verified' }),
                result('bad', { tier: 'suspicious' }),
                result('plain'),
                result('good', { tier: 'verified' }),
            ],
            'x',
        )

        expect(names(ranked)).toEqual(['good', 'plain', 'bad', 'nft'])
    })

    it('puts an exact name or symbol match first within its group, whatever the case', () => {
        const ranked = rankSearchAssets(
            [
                result('USD Coin Wrapped', { tier: 'verified' }),
                result('Tether', { unitName: 'USDt', tier: 'verified' }),
                result('USD Coin', { unitName: 'USDC', tier: 'verified' }),
                result('usdc', { unitName: 'FAKE' }),
            ],
            ' usdc ',
        )

        // The unverified exact match still stays below every verified token.
        expect(names(ranked)).toEqual([
            'USD Coin',
            'USD Coin Wrapped',
            'Tether',
            'usdc',
        ])
    })

    it('keeps the search order among equals', () => {
        const ranked = rankSearchAssets(
            [result('b'), result('a'), result('c')],
            'x',
        )

        expect(names(ranked)).toEqual(['b', 'a', 'c'])
    })
})

describe('isCollectibleResult', () => {
    it('is true for the collectible type and for a result carrying collectible data', () => {
        expect(isCollectibleResult(result('n', { type: 'collectible' }))).toBe(
            true,
        )
        const withData = result('m')
        withData.asset.peraMetadata = {
            ...withData.asset.peraMetadata,
            collectible: { title: 'm' },
        }
        expect(isCollectibleResult(withData)).toBe(true)
        expect(isCollectibleResult(result('t'))).toBe(false)
    })
})

describe('isRelevantSearchResult', () => {
    it('keeps an unverified asset only when a word of its name or symbol starts with the query', () => {
        const keeps = (name: string, query: string, unitName?: string) =>
            isRelevantSearchResult(result(name, { unitName }), query)

        expect(keeps('Uniswap#0 Collection', 'uniswap')).toBe(true)
        expect(keeps('Black Uniswap Reaper', ' Uniswap ')).toBe(true)
        expect(keeps('uniswap.algo', 'uniswa')).toBe(true)
        expect(keeps('Wrapped Token', 'aave', 'AAVE')).toBe(true)
        expect(keeps('rug.ninja', 'uniswa')).toBe(false)
        expect(keeps('84958523;CAAVERO', 'aave')).toBe(false)
        expect(keeps('GloC-Net', 'aave', 'SAAVEDRA')).toBe(false)
    })

    it('keeps a verified asset however loosely it matched', () => {
        expect(
            isRelevantSearchResult(
                result('United Stables', { tier: 'verified' }),
                'uniswa',
            ),
        ).toBe(true)
    })

    it('keeps the asset whose id is the query', () => {
        // The fixture uses the name as the asset id.
        expect(isRelevantSearchResult(result('0xABC'), '0xabc')).toBe(true)
    })

    it('keeps everything for an empty query', () => {
        expect(isRelevantSearchResult(result('rug.ninja'), '  ')).toBe(true)
    })
})
