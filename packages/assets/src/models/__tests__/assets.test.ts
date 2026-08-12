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

import { ALGO_ASSET, getKnownAssetId } from '../assets'
import { toWholeUnits } from '../../utils'

describe('ALGO_ASSET', () => {
    test('totalSupply is the chain total of 10B ALGO, in base units', () => {
        // Seeded into SQLite at startup and read back as authoritative, so this
        // constant is what Asset Details renders — no API value corrects it.
        expect(ALGO_ASSET.totalSupply.toFixed()).toBe('10000000000000000')
        expect(toWholeUnits(ALGO_ASSET.totalSupply, ALGO_ASSET)).toStrictEqual(
            new Decimal('10000000000'),
        )
    })
})

describe('known asset ids', () => {
    test('getKnownAssetId returns null where the asset has no known id', () => {
        expect(getKnownAssetId('USDC', 'mainnet')).toBe('31566704')
        expect(getKnownAssetId('USDC', 'testnet')).toBe('10458941')
        // Was TestNet's id, which does not identify USDC on these chains.
        expect(getKnownAssetId('USDC', 'betanet')).toBeNull()
        expect(getKnownAssetId('USDC', 'custom')).toBeNull()
    })
})
