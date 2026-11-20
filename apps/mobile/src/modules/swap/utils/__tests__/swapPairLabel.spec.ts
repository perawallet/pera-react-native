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
import { swapPairLabel } from '../swapPairLabel'

const ref = {
    chainId: 'algorand',
    networkId: 'mainnet',
    assetId: '31566704',
} as const

describe('swapPairLabel', () => {
    it('names each side by unit name', () => {
        expect(
            swapPairLabel({
                assetIn: { ref, unitName: 'USDC' },
                assetOut: { ref, unitName: 'ALGO' },
            }),
        ).toBe('USDC → ALGO')
    })

    it('falls back to the asset id when a side has no unit name', () => {
        expect(
            swapPairLabel({
                assetIn: { ref, unitName: null },
                assetOut: { ref, unitName: 'ALGO' },
            }),
        ).toBe('31566704 → ALGO')
    })
})
