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
import { Decimal } from 'decimal.js'
import {
    toWholeUnits,
    toDecimalUnits,
    isPureNft,
    hasNftShape,
    isCollectible,
    formatCollectibleAmount,
    formatAssetAmount,
} from '../utils'
import { PeraAssetType, type PeraAsset } from '../models'

// Helper to create a valid PeraAsset for testing
const createTestAsset = (decimals: number, name = 'TestAsset'): PeraAsset => ({
    assetId: '0',
    name,
    decimals,
    unitName: name.toUpperCase(),
    creator: { address: '' },
    totalSupply: new Decimal(1000000),
})

describe('utils', () => {
    describe('toWholeUnits', () => {
        test('converts microAlgos to Algos (6 decimals)', () => {
            const asset = createTestAsset(6, 'ALGO')

            expect(toWholeUnits(1000000, asset)).toEqual(new Decimal(1))
            expect(toWholeUnits(5000000, asset)).toEqual(new Decimal(5))
            expect(toWholeUnits(1500000, asset)).toEqual(new Decimal(1.5))
        })

        test('converts token amounts with 2 decimals', () => {
            const asset = createTestAsset(2, 'TestToken')

            expect(toWholeUnits(100, asset)).toEqual(new Decimal(1))
            expect(toWholeUnits(150, asset)).toEqual(new Decimal(1.5))
            expect(toWholeUnits(1000, asset)).toEqual(new Decimal(10))
        })

        test('handles 0 decimals (no conversion)', () => {
            const asset = createTestAsset(0, 'NFT')

            expect(toWholeUnits(1, asset)).toEqual(new Decimal(1))
            expect(toWholeUnits(100, asset)).toEqual(new Decimal(100))
        })

        test('handles Decimal input', () => {
            const asset = createTestAsset(6, 'ALGO')

            expect(toWholeUnits(new Decimal(1000000), asset)).toEqual(
                new Decimal(1),
            )
            expect(toWholeUnits(new Decimal('5500000.5'), asset)).toEqual(
                new Decimal('5.5000005'),
            )
        })

        test('handles bigint input', () => {
            const asset = createTestAsset(6, 'ALGO')

            expect(toWholeUnits(BigInt(1000000), asset)).toEqual(new Decimal(1))
            expect(toWholeUnits(BigInt(10000000), asset)).toEqual(
                new Decimal(10),
            )
        })

        test('handles zero value', () => {
            const asset = createTestAsset(6, 'ALGO')

            expect(toWholeUnits(0, asset)).toEqual(new Decimal(0))
            expect(toWholeUnits(new Decimal(0), asset)).toEqual(new Decimal(0))
            expect(toWholeUnits(BigInt(0), asset)).toEqual(new Decimal(0))
        })

        test('handles very small values', () => {
            const asset = createTestAsset(6, 'ALGO')

            expect(toWholeUnits(1, asset)).toEqual(new Decimal('0.000001'))
        })

        test('handles high precision decimals', () => {
            const asset = createTestAsset(18, 'HighPrecision')

            const input = new Decimal('1000000000000000000') // 10^18
            expect(toWholeUnits(input, asset)).toEqual(new Decimal(1))
        })
    })

    describe('toDecimalUnits', () => {
        test('converts Algos to microAlgos (6 decimals)', () => {
            const asset = createTestAsset(6, 'ALGO')

            expect(toDecimalUnits(1, asset)).toEqual(new Decimal(1000000))
            expect(toDecimalUnits(5, asset)).toEqual(new Decimal(5000000))
            expect(toDecimalUnits(1.5, asset)).toEqual(new Decimal(1500000))
        })

        test('converts token amounts with 2 decimals', () => {
            const asset = createTestAsset(2, 'TestToken')

            expect(toDecimalUnits(1, asset)).toEqual(new Decimal(100))
            expect(toDecimalUnits(1.5, asset)).toEqual(new Decimal(150))
            expect(toDecimalUnits(10, asset)).toEqual(new Decimal(1000))
        })

        test('handles 0 decimals (no conversion)', () => {
            const asset = createTestAsset(0, 'NFT')

            expect(toDecimalUnits(1, asset)).toEqual(new Decimal(1))
            expect(toDecimalUnits(100, asset)).toEqual(new Decimal(100))
        })

        test('handles Decimal input', () => {
            const asset = createTestAsset(6, 'ALGO')

            expect(toDecimalUnits(new Decimal(1), asset)).toEqual(
                new Decimal(1000000),
            )
            expect(toDecimalUnits(new Decimal('5.5'), asset)).toEqual(
                new Decimal(5500000),
            )
        })

        test('handles bigint input', () => {
            const asset = createTestAsset(6, 'ALGO')

            expect(toDecimalUnits(BigInt(1), asset)).toEqual(
                new Decimal(1000000),
            )
            expect(toDecimalUnits(BigInt(10), asset)).toEqual(
                new Decimal(10000000),
            )
        })

        test('handles zero value', () => {
            const asset = createTestAsset(6, 'ALGO')

            expect(toDecimalUnits(0, asset)).toEqual(new Decimal(0))
            expect(toDecimalUnits(new Decimal(0), asset)).toEqual(
                new Decimal(0),
            )
            expect(toDecimalUnits(BigInt(0), asset)).toEqual(new Decimal(0))
        })

        test('handles fractional values', () => {
            const asset = createTestAsset(6, 'ALGO')

            expect(toDecimalUnits(0.000001, asset)).toEqual(new Decimal(1))
            expect(toDecimalUnits(0.5, asset)).toEqual(new Decimal(500000))
        })

        test('handles high precision decimals', () => {
            const asset = createTestAsset(18, 'HighPrecision')

            expect(toDecimalUnits(1, asset)).toEqual(
                new Decimal('1000000000000000000'),
            )
        })

        test('toWholeUnits and toDecimalUnits are inverse operations', () => {
            const asset = createTestAsset(6, 'ALGO')

            const original = new Decimal(123.456789)
            const decimal = toDecimalUnits(original, asset)
            const whole = toWholeUnits(decimal, asset)

            expect(whole).toEqual(original)
        })
    })

    describe('isPureNft', () => {
        test('returns true for pure NFT (totalSupply=1, decimals=0)', () => {
            const asset = createTestAsset(0, 'PureNFT')
            asset.totalSupply = new Decimal(1)

            expect(isPureNft(asset)).toBe(true)
        })

        test('returns false when totalSupply > 1', () => {
            const asset = createTestAsset(0, 'FractionalNFT')
            asset.totalSupply = new Decimal(100)

            expect(isPureNft(asset)).toBe(false)
        })

        test('returns false when decimals > 0', () => {
            const asset = createTestAsset(6, 'Token')
            asset.totalSupply = new Decimal(1)

            expect(isPureNft(asset)).toBe(false)
        })

        test('returns false for standard fungible asset', () => {
            const asset = createTestAsset(6, 'ALGO')

            expect(isPureNft(asset)).toBe(false)
        })
    })

    describe('hasNftShape', () => {
        test.each([
            ['pure NFT', 0, '1', true],
            ['editioned NFT (indivisible, many copies)', 0, '1000', true],
            ['ARC-3 fractional NFT (10^decimals)', 2, '100', true],
            ['fungible token', 6, '10000000000', false],
            ['divisible supply below 10^decimals', 2, '50', false],
        ])('%s', (_label, decimals, totalSupply, expected) => {
            expect(
                hasNftShape({
                    decimals: decimals as number,
                    totalSupply: new Decimal(totalSupply as string),
                }),
            ).toBe(expected)
        })
    })

    describe('isCollectible', () => {
        test('returns true when type is collectible', () => {
            const asset: PeraAsset = {
                ...createTestAsset(0, 'NFT'),
                peraMetadata: {
                    isDeleted: false,
                    verificationTier: 'unverified',
                    type: PeraAssetType.collectible,
                },
            }

            expect(isCollectible(asset)).toBe(true)
        })

        test('returns false when type is standard_asset', () => {
            const asset: PeraAsset = {
                ...createTestAsset(6, 'Token'),
                peraMetadata: {
                    isDeleted: false,
                    verificationTier: 'verified',
                    type: PeraAssetType.standard_asset,
                },
            }

            expect(isCollectible(asset)).toBe(false)
        })

        test('returns false when type is algo', () => {
            const asset: PeraAsset = {
                ...createTestAsset(6, 'ALGO'),
                peraMetadata: {
                    isDeleted: false,
                    verificationTier: 'verified',
                    type: PeraAssetType.algo,
                },
            }

            expect(isCollectible(asset)).toBe(false)
        })

        test('returns false when peraMetadata is undefined', () => {
            const asset = createTestAsset(0, 'Unknown')
            asset.peraMetadata = undefined

            expect(isCollectible(asset)).toBe(false)
        })

        test('returns false when type is undefined', () => {
            const asset: PeraAsset = {
                ...createTestAsset(0, 'NoType'),
                peraMetadata: {
                    isDeleted: false,
                    verificationTier: 'unverified',
                },
            }

            expect(isCollectible(asset)).toBe(false)
        })
    })

    describe('formatCollectibleAmount', () => {
        test('returns empty string for pure NFT', () => {
            const asset = createTestAsset(0, 'PureNFT')
            asset.totalSupply = new Decimal(1)

            expect(formatCollectibleAmount(new Decimal(1), asset)).toBe('')
        })

        test('returns "x" prefixed amount for fractional NFT', () => {
            const asset = createTestAsset(2, 'FractionalNFT')
            asset.totalSupply = new Decimal(100)

            expect(formatCollectibleAmount(new Decimal(5), asset)).toBe('x5')
        })

        test('returns "x" prefixed decimal amount', () => {
            const asset = createTestAsset(6, 'FractionalNFT')
            asset.totalSupply = new Decimal(1000000)

            expect(formatCollectibleAmount(new Decimal('0.5'), asset)).toBe(
                'x0.5',
            )
        })

        test('returns "x0" for zero amount on non-pure asset', () => {
            const asset = createTestAsset(6, 'FractionalNFT')
            asset.totalSupply = new Decimal(1000000)

            expect(formatCollectibleAmount(new Decimal(0), asset)).toBe('x0')
        })
    })

    describe('formatAssetAmount', () => {
        test('formats amount with 6 decimals and unit name', () => {
            const result = formatAssetAmount(new Decimal(1000000), {
                decimals: 6,
                unitName: 'ALGO',
            })
            expect(result).toBe('1.00 ALGO')
        })

        test('formats amount with 0 decimals', () => {
            const result = formatAssetAmount(new Decimal(42), {
                decimals: 0,
                unitName: 'NFT',
            })
            expect(result).toBe('42.00 NFT')
        })

        test('handles missing unitName', () => {
            const result = formatAssetAmount(new Decimal(1000000), {
                decimals: 6,
            })
            expect(result).toBe('1.00')
        })

        test('handles missing decimals (defaults to 0)', () => {
            const result = formatAssetAmount(new Decimal(100), {
                unitName: 'TOKEN',
            })
            expect(result).toBe('100.00 TOKEN')
        })

        test('formats string input', () => {
            const result = formatAssetAmount('5000000', {
                decimals: 6,
                unitName: 'ALGO',
            })
            expect(result).toBe('5.00 ALGO')
        })

        test('formats fractional amounts with minimum 2 decimal places', () => {
            const result = formatAssetAmount(new Decimal(1500000), {
                decimals: 6,
                unitName: 'ALGO',
            })
            expect(result).toBe('1.50 ALGO')
        })
    })
})
