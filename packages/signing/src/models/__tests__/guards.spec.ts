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

import { describe, it, expect } from 'vitest'
import {
    isTransactionRequest,
    isArbitraryDataRequest,
    isArc60Request,
} from '../guards'
import type { SignRequest } from '../index'

const base = { id: 'req-1', transport: 'algod' as const }

const transactionRequest = {
    ...base,
    type: 'transactions',
    txs: [],
} as unknown as SignRequest

const arbitraryDataRequest = {
    ...base,
    type: 'arbitrary-data',
    data: [],
} as unknown as SignRequest

const arc60Request = {
    ...base,
    type: 'arc60',
    stdSigData: {},
    metadata: {},
} as unknown as SignRequest

describe('isTransactionRequest', () => {
    it('returns true only for a transactions request carrying `txs`', () => {
        expect(isTransactionRequest(transactionRequest)).toBe(true)
        expect(isTransactionRequest(arbitraryDataRequest)).toBe(false)
        expect(isTransactionRequest(arc60Request)).toBe(false)
    })

    it('returns false when type matches but the `txs` discriminant is absent', () => {
        const malformed = {
            ...base,
            type: 'transactions',
        } as unknown as SignRequest

        expect(isTransactionRequest(malformed)).toBe(false)
    })
})

describe('isArbitraryDataRequest', () => {
    it('returns true only for an arbitrary-data request carrying `data`', () => {
        expect(isArbitraryDataRequest(arbitraryDataRequest)).toBe(true)
        expect(isArbitraryDataRequest(transactionRequest)).toBe(false)
        expect(isArbitraryDataRequest(arc60Request)).toBe(false)
    })

    it('returns false when type matches but the `data` discriminant is absent', () => {
        const malformed = {
            ...base,
            type: 'arbitrary-data',
        } as unknown as SignRequest

        expect(isArbitraryDataRequest(malformed)).toBe(false)
    })
})

describe('isArc60Request', () => {
    it('returns true only for an arc60 request carrying `stdSigData`', () => {
        expect(isArc60Request(arc60Request)).toBe(true)
        expect(isArc60Request(transactionRequest)).toBe(false)
        expect(isArc60Request(arbitraryDataRequest)).toBe(false)
    })

    it('returns false when type matches but the `stdSigData` discriminant is absent', () => {
        const malformed = { ...base, type: 'arc60' } as unknown as SignRequest

        expect(isArc60Request(malformed)).toBe(false)
    })
})
