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
import type { PeraDisplayableTransaction } from '@perawallet/wallet-core-chain-algorand/blockchain'
import type { TransactionNative } from '@perawallet/wallet-core-chain-contract'
import { toGroupTransactionRows } from '../groupTransactionRows'

const tx = (id: string) => ({ id }) as PeraDisplayableTransaction

describe('toGroupTransactionRows', () => {
    it('pairs each Algorand member with the view read out of it', () => {
        const first: TransactionNative = {
            family: 'algorand',
            transaction: tx('A'),
        }
        const second: TransactionNative = {
            family: 'algorand',
            transaction: tx('B'),
        }

        const rows = toGroupTransactionRows([first, second])

        expect(rows).toEqual([
            { native: first, view: tx('A') },
            { native: second, view: tx('B') },
        ])
        expect(rows[0]?.native).toBe(first)
    })

    it('leaves out a member that is not an Algorand transaction', () => {
        const algorand: TransactionNative = {
            family: 'algorand',
            transaction: tx('A'),
        }

        const rows = toGroupTransactionRows([
            algorand,
            { family: 'evm', transaction: { id: 'eth' } },
        ])

        expect(rows).toEqual([{ native: algorand, view: tx('A') }])
    })
})
