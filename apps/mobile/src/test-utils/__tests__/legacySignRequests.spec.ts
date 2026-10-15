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
import type { SignRequest } from '@perawallet/wallet-core-signing'
import { legacySignRequestIds } from '../legacySignRequests'

const chainNeutral = {
    id: 'neutral',
    type: 'transactions',
    transport: 'callback',
    txs: [
        {
            scope: { chainId: 'algorand', networkId: 'mainnet' },
            payload: {},
            summary: {},
            chainData: { family: 'algorand' },
        },
    ],
} as unknown as SignRequest

const legacy = {
    id: 'legacy',
    type: 'transactions',
    transport: 'callback',
    chainId: 'algorand',
    txs: [{ sender: 'SENDER', fee: 1000n }],
} as unknown as SignRequest

const arbitraryData = {
    id: 'data',
    type: 'arbitrary-data',
    chainId: 'algorand',
    data: [],
} as unknown as SignRequest

describe('legacySignRequestIds', () => {
    it('names a transaction request built from PeraTransaction', () => {
        expect(legacySignRequestIds([chainNeutral, legacy])).toEqual(['legacy'])
    })

    it('passes chain-neutral and non-transaction requests', () => {
        expect(legacySignRequestIds([chainNeutral, arbitraryData])).toEqual([])
    })
})
