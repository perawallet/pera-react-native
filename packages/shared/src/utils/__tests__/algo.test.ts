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

import { describe, test, expect } from 'vitest'
import { displayCurrencyToAssetId, isAlgoAssetId } from '../algo'

describe('isAlgoAssetId', () => {
    test('returns true for the ALGO string id', () => {
        expect(isAlgoAssetId('0')).toBe(true)
    })

    test('returns true for the ALGO numeric id', () => {
        expect(isAlgoAssetId(0)).toBe(true)
    })

    test('returns false for non-ALGO ids', () => {
        expect(isAlgoAssetId('31566704')).toBe(false)
        expect(isAlgoAssetId(31566704)).toBe(false)
    })

    test('returns false for a missing id', () => {
        expect(isAlgoAssetId(null)).toBe(false)
        expect(isAlgoAssetId(undefined)).toBe(false)
    })
})

describe('displayCurrencyToAssetId', () => {
    test("maps the ALGO ticker to Algo's asset id", () => {
        expect(displayCurrencyToAssetId('ALGO')).toBe('0')
    })

    test('maps fiat codes to null', () => {
        expect(displayCurrencyToAssetId('USD')).toBeNull()
        expect(displayCurrencyToAssetId('EUR')).toBeNull()
    })

    test('only the exact ticker qualifies', () => {
        expect(displayCurrencyToAssetId('algo')).toBeNull()
        expect(displayCurrencyToAssetId('')).toBeNull()
    })
})
