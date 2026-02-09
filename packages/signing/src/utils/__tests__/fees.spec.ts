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
import { calculateTotalFee } from '../fees'
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-blockchain'
import Decimal from 'decimal.js'

const makeTx = (fee?: bigint): PeraDisplayableTransaction =>
    ({
        fee,
        sender: 'ADDR1',
    }) as unknown as PeraDisplayableTransaction

describe('calculateTotalFee', () => {
    test('returns 0 for empty array', () => {
        expect(calculateTotalFee([], new Set()).eq(new Decimal(0))).toBe(true)
    })

    test('sums fees from multiple transactions', () => {
        const txs = [makeTx(1000n), makeTx(2000n), makeTx(3000n)]
        // 6000 microAlgo = 0.006 ALGO
        expect(
            calculateTotalFee(txs, new Set(['ADDR1'])).eq(new Decimal(0.006)),
        ).toBe(true)
    })

    test('treats undefined fee as 0', () => {
        const txs = [makeTx(1000n), makeTx(undefined), makeTx(2000n)]
        // 3000 microAlgo = 0.003 ALGO
        expect(
            calculateTotalFee(txs, new Set(['ADDR1'])).eq(new Decimal(0.003)),
        ).toBe(true)
    })

    test('handles single transaction', () => {
        // 500 microAlgo = 0.0005 ALGO
        expect(
            calculateTotalFee([makeTx(500n)], new Set(['ADDR1'])).eq(
                new Decimal(0.0005),
            ),
        ).toBe(true)
    })
})
