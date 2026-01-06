/*
 Copyright 2022-2025 Pera Wallet, LDA
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
import Decimal from 'decimal.js'
import { toWholeUnits, toDecimalUnits } from '../utils'
import type { PeraAsset } from '../models'

// Helper to create a valid PeraAsset for testing
const createTestAsset = (decimals: number, name = 'TestAsset'): PeraAsset => ({
    assetId: '0',
    name,
    decimals,
    unitName: name.toUpperCase(),
    creator: { address: '' },
    totalSupply: Decimal(1000000),
})

describe('utils', () => {
    describe('toWholeUnits', () => {
        test('converts microAlgos to Algos (6 decimals)', () => {
            const asset = createTestAsset(6, 'ALGO')

            expect(toWholeUnits(1000000, asset)).toEqual(Decimal(1))
            expect(toWholeUnits(5000000, asset)).toEqual(Decimal(5))
            expect(toWholeUnits(1500000, asset)).toEqual(Decimal(1.5))
        })

        test('converts token amounts with 2 decimals', () => {
            const asset = createTestAsset(2, 'TestToken')

            expect(toWholeUnits(100, asset)).toEqual(Decimal(1))
            expect(toWholeUnits(150, asset)).toEqual(Decimal(1.5))
            expect(toWholeUnits(1000, asset)).toEqual(Decimal(10))
        })

        test('handles 0 decimals (no conversion)', () => {
            const asset = createTestAsset(0, 'NFT')

            expect(toWholeUnits(1, asset)).toEqual(Decimal(1))
            expect(toWholeUnits(100, asset)).toEqual(Decimal(100))
        })

        test('handles Decimal input', () => {
            const asset = createTestAsset(6, 'ALGO')

            expect(toWholeUnits(Decimal(1000000), asset)).toEqual(Decimal(1))
            expect(toWholeUnits(Decimal('5500000.5'), asset)).toEqual(
                Decimal('5.5000005'),
            )
        })

        test('handles bigint input', () => {
            const asset = createTestAsset(6, 'ALGO')

            expect(toWholeUnits(BigInt(1000000), asset)).toEqual(Decimal(1))
            expect(toWholeUnits(BigInt(10000000), asset)).toEqual(Decimal(10))
        })

        test('handles zero value', () => {
            const asset = createTestAsset(6, 'ALGO')

            expect(toWholeUnits(0, asset)).toEqual(Decimal(0))
            expect(toWholeUnits(Decimal(0), asset)).toEqual(Decimal(0))
            expect(toWholeUnits(BigInt(0), asset)).toEqual(Decimal(0))
        })

        test('handles very small values', () => {
            const asset = createTestAsset(6, 'ALGO')

            expect(toWholeUnits(1, asset)).toEqual(Decimal('0.000001'))
        })

        test('handles high precision decimals', () => {
            const asset = createTestAsset(18, 'HighPrecision')

            const input = Decimal('1000000000000000000') // 10^18
            expect(toWholeUnits(input, asset)).toEqual(Decimal(1))
        })
    })

    describe('toDecimalUnits', () => {
        test('converts Algos to microAlgos (6 decimals)', () => {
            const asset = createTestAsset(6, 'ALGO')

            expect(toDecimalUnits(1, asset)).toEqual(Decimal(1000000))
            expect(toDecimalUnits(5, asset)).toEqual(Decimal(5000000))
            expect(toDecimalUnits(1.5, asset)).toEqual(Decimal(1500000))
        })

        test('converts token amounts with 2 decimals', () => {
            const asset = createTestAsset(2, 'TestToken')

            expect(toDecimalUnits(1, asset)).toEqual(Decimal(100))
            expect(toDecimalUnits(1.5, asset)).toEqual(Decimal(150))
            expect(toDecimalUnits(10, asset)).toEqual(Decimal(1000))
        })

        test('handles 0 decimals (no conversion)', () => {
            const asset = createTestAsset(0, 'NFT')

            expect(toDecimalUnits(1, asset)).toEqual(Decimal(1))
            expect(toDecimalUnits(100, asset)).toEqual(Decimal(100))
        })

        test('handles Decimal input', () => {
            const asset = createTestAsset(6, 'ALGO')

            expect(toDecimalUnits(Decimal(1), asset)).toEqual(Decimal(1000000))
            expect(toDecimalUnits(Decimal('5.5'), asset)).toEqual(
                Decimal(5500000),
            )
        })

        test('handles bigint input', () => {
            const asset = createTestAsset(6, 'ALGO')

            expect(toDecimalUnits(BigInt(1), asset)).toEqual(Decimal(1000000))
            expect(toDecimalUnits(BigInt(10), asset)).toEqual(Decimal(10000000))
        })

        test('handles zero value', () => {
            const asset = createTestAsset(6, 'ALGO')

            expect(toDecimalUnits(0, asset)).toEqual(Decimal(0))
            expect(toDecimalUnits(Decimal(0), asset)).toEqual(Decimal(0))
            expect(toDecimalUnits(BigInt(0), asset)).toEqual(Decimal(0))
        })

        test('handles fractional values', () => {
            const asset = createTestAsset(6, 'ALGO')

            expect(toDecimalUnits(0.000001, asset)).toEqual(Decimal(1))
            expect(toDecimalUnits(0.5, asset)).toEqual(Decimal(500000))
        })

        test('handles high precision decimals', () => {
            const asset = createTestAsset(18, 'HighPrecision')

            expect(toDecimalUnits(1, asset)).toEqual(
                Decimal('1000000000000000000'),
            )
        })

        test('toWholeUnits and toDecimalUnits are inverse operations', () => {
            const asset = createTestAsset(6, 'ALGO')

            const original = Decimal(123.456789)
            const decimal = toDecimalUnits(original, asset)
            const whole = toWholeUnits(decimal, asset)

            expect(whole).toEqual(original)
        })
    })
})
