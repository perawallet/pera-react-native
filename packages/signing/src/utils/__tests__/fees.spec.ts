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

const makeTx = (fee?: bigint): PeraDisplayableTransaction =>
    ({
        fee,
        sender: 'ADDR1',
    }) as unknown as PeraDisplayableTransaction

describe('calculateTotalFee', () => {
    test('returns 0n for empty array', () => {
        expect(calculateTotalFee([], new Set())).toBe(0n)
    })

    test('sums fees from multiple transactions', () => {
        const txs = [makeTx(1000n), makeTx(2000n), makeTx(3000n)]
        expect(calculateTotalFee(txs, new Set(['ADDR1']))).toBe(6000n)
    })

    test('treats undefined fee as 0n', () => {
        const txs = [makeTx(1000n), makeTx(undefined), makeTx(2000n)]
        expect(calculateTotalFee(txs, new Set(['ADDR1']))).toBe(3000n)
    })

    test('handles single transaction', () => {
        expect(calculateTotalFee([makeTx(500n)], new Set(['ADDR1']))).toBe(500n)
    })
})
