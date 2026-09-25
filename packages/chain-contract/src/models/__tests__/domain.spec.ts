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
import { assetRefKey, isNativeAsset } from '../domain'
import type { ChainId } from '../identity'

// ChainId has one member today; a second chain is simulated with a cast.
const OTHER = 'other' as ChainId

const algorandDescriptor = {
    id: 'algorand' as const,
    nativeAsset: { assetId: '0' },
}

describe('assetRefKey', () => {
    it('joins the chain id and asset id', () => {
        expect(assetRefKey({ chainId: 'algorand', assetId: '0' })).toBe(
            'algorand/0',
        )
    })

    it('keeps the same asset id on two chains apart', () => {
        const algorandKey = assetRefKey({ chainId: 'algorand', assetId: '0' })
        const otherKey = assetRefKey({ chainId: OTHER, assetId: '0' })

        expect(algorandKey).not.toBe(otherKey)
    })
})

describe('isNativeAsset', () => {
    it('is true for the chain native asset', () => {
        expect(
            isNativeAsset(
                { chainId: 'algorand', assetId: '0' },
                algorandDescriptor,
            ),
        ).toBe(true)
    })

    it('is false for the same asset id on another chain', () => {
        expect(
            isNativeAsset({ chainId: OTHER, assetId: '0' }, algorandDescriptor),
        ).toBe(false)
    })

    it('is false for another asset on the same chain', () => {
        expect(
            isNativeAsset(
                { chainId: 'algorand', assetId: '31566704' },
                algorandDescriptor,
            ),
        ).toBe(false)
    })
})
