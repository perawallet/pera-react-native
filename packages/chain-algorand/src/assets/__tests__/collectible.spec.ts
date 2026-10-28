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

import { describe, expect, test } from 'vitest'
import { Decimal } from 'decimal.js'
import {
    hasAlgorandNftShape,
    isUniqueAlgorandCollectible,
} from '../collectible'

describe('isUniqueAlgorandCollectible', () => {
    test.each([
        ['pure NFT', 0, '1', true],
        ['editioned NFT', 0, '1000', false],
        ['ARC-3 fractional NFT', 2, '100', false],
        ['single unit with decimals', 6, '1', false],
    ])('%s', (_label, decimals, totalSupply, expected) => {
        expect(
            isUniqueAlgorandCollectible({
                decimals: decimals as number,
                totalSupply: new Decimal(totalSupply as string),
            }),
        ).toBe(expected)
    })
})

describe('hasAlgorandNftShape', () => {
    test.each([
        ['pure NFT', 0, '1', true],
        ['editioned NFT (indivisible, many copies)', 0, '1000', true],
        ['ARC-3 fractional NFT (10^decimals)', 2, '100', true],
        [
            'ARC-3 fractional NFT at 19 decimals',
            19,
            '10000000000000000000',
            true,
        ],
        ['fungible token', 6, '10000000000', false],
        ['divisible supply below 10^decimals', 2, '50', false],
    ])('%s', (_label, decimals, totalSupply, expected) => {
        expect(
            hasAlgorandNftShape({
                decimals: decimals as number,
                totalSupply: new Decimal(totalSupply as string),
            }),
        ).toBe(expected)
    })
})
