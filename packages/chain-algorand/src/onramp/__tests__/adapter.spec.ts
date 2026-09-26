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
import type { RampToken } from '@perawallet/wallet-core-onramp'
import { algorandRampAdapter as adapter } from '../adapter'

const token = (overrides: Partial<RampToken>): RampToken =>
    ({
        id: '31566704',
        symbol: 'USDC',
        name: 'USDC',
        ...overrides,
    }) as RampToken

describe('algorandRampAdapter', () => {
    it('asks the ramp catalogue for ALGO and USDC on Algorand', () => {
        expect(adapter.destinationTokenIds).toEqual(['ALGO', 'USDC_ALGORAND'])
    })

    it('recognises ALGO by its asset id', () => {
        expect(adapter.isNativeToken(token({ id: '0', symbol: 'XALGO' }))).toBe(
            true,
        )
    })

    it('falls back to the ticker when the provider gives no asset id', () => {
        expect(
            adapter.isNativeToken(token({ id: 'ALGO', symbol: 'ALGO' })),
        ).toBe(true)
    })

    it('does not treat another asset as ALGO', () => {
        expect(adapter.isNativeToken(token({}))).toBe(false)
    })

    it('ignores an ALGO ticker on a token that has another asset id', () => {
        expect(adapter.isNativeToken(token({ symbol: 'ALGO' }))).toBe(false)
    })

    it("pins ALGO to the native asset id whatever the provider's id is", () => {
        expect(adapter.toAssetId(token({ id: 'ALGO', symbol: 'ALGO' }))).toBe(
            '0',
        )
    })

    it('keeps the provider id for any other token', () => {
        expect(adapter.toAssetId(token({}))).toBe('31566704')
    })
})
