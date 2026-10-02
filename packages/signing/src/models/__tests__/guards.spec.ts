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
    isAuthDataRequest,
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

const authDataRequest = {
    ...base,
    type: 'auth-data',
    authData: {},
    metadata: {},
} as unknown as SignRequest

describe('isTransactionRequest', () => {
    it('returns true only for a transactions request carrying `txs`', () => {
        expect(isTransactionRequest(transactionRequest)).toBe(true)
        expect(isTransactionRequest(arbitraryDataRequest)).toBe(false)
        expect(isTransactionRequest(authDataRequest)).toBe(false)
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
        expect(isArbitraryDataRequest(authDataRequest)).toBe(false)
    })

    it('returns false when type matches but the `data` discriminant is absent', () => {
        const malformed = {
            ...base,
            type: 'arbitrary-data',
        } as unknown as SignRequest

        expect(isArbitraryDataRequest(malformed)).toBe(false)
    })
})

describe('isAuthDataRequest', () => {
    it('returns true only for an auth-data request carrying `authData`', () => {
        expect(isAuthDataRequest(authDataRequest)).toBe(true)
        expect(isAuthDataRequest(transactionRequest)).toBe(false)
        expect(isAuthDataRequest(arbitraryDataRequest)).toBe(false)
    })

    it('returns false when type matches but the `authData` discriminant is absent', () => {
        const malformed = {
            ...base,
            type: 'auth-data',
        } as unknown as SignRequest

        expect(isAuthDataRequest(malformed)).toBe(false)
    })
})
