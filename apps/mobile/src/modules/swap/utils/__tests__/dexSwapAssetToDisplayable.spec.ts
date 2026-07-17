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

// @vitest-environment node

import { describe, it, expect } from 'vitest'
import type { DexSwapAsset } from '@perawallet/wallet-core-swaps'
import { dexSwapAssetToDisplayable } from '../dexSwapAssetToDisplayable'

const dexAsset = (overrides: Partial<DexSwapAsset> = {}): DexSwapAsset =>
    ({
        assetId: 31_566_704,
        name: 'USD Coin',
        unitName: 'USDC',
        decimals: 6,
        logo: 'https://cdn/usdc.png',
        ...overrides,
    }) as unknown as DexSwapAsset

describe('dexSwapAssetToDisplayable', () => {
    it('maps the core asset fields through unchanged', () => {
        const result = dexSwapAssetToDisplayable(dexAsset())
        expect(result).toMatchObject({
            assetId: 31_566_704,
            name: 'USD Coin',
            unitName: 'USDC',
            decimals: 6,
        })
    })

    it('carries the logo into peraMetadata when present', () => {
        const result = dexSwapAssetToDisplayable(dexAsset())
        expect(result.peraMetadata).toEqual({ logo: 'https://cdn/usdc.png' })
    })

    it('leaves peraMetadata undefined when there is no logo', () => {
        const result = dexSwapAssetToDisplayable(dexAsset({ logo: undefined }))
        expect(result.peraMetadata).toBeUndefined()
    })
})
