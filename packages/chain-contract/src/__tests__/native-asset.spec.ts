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
import { CHAIN_IDS } from '../models/identity'
import { nativeAssetDecimals } from '../native-asset'

describe('nativeAssetDecimals', () => {
    it('gives Algorand six decimals, so base units are microAlgos', () => {
        expect(nativeAssetDecimals('algorand')).toBe(6)
    })

    it.each(CHAIN_IDS)('has a non-negative integer for %s', chainId => {
        const decimals = nativeAssetDecimals(chainId)

        expect(Number.isInteger(decimals)).toBe(true)
        expect(decimals).toBeGreaterThanOrEqual(0)
    })
})
