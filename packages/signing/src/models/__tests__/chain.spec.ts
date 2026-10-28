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
import { makeUnsignedTransaction } from '../../__tests__/transactions'
import { chainIdOfSignRequest, scopeOfSignRequest } from '../chain'
import type { SignRequest } from '../index'

const base = { id: 'req-1', transport: 'network' as const }

describe('chainIdOfSignRequest', () => {
    it.each([
        { type: 'transactions', txs: [] },
        { type: 'arbitrary-data', data: [] },
        { type: 'auth-data', authData: {}, metadata: {} },
    ])('resolves a $type request to the chain it is stamped with', shape => {
        const request = {
            ...base,
            ...shape,
            chainId: 'ethereum',
        } as unknown as SignRequest

        expect(chainIdOfSignRequest(request)).toBe('ethereum')
    })

    it("resolves a chain-neutral transaction request to its transactions' chain", () => {
        const request = {
            ...base,
            type: 'transactions',
            txs: [makeUnsignedTransaction('0xFROM')],
        } as SignRequest

        expect(chainIdOfSignRequest(request)).toBe('ethereum')
    })

    it('resolves a message request to the chain of its scope', () => {
        const request = {
            ...base,
            type: 'message',
            message: {
                scope: { chainId: 'ethereum', networkId: 'mainnet' },
                method: 'plain',
                signer: '0xFROM',
                payload: {},
            },
        } as unknown as SignRequest

        expect(chainIdOfSignRequest(request)).toBe('ethereum')
    })
})

describe('scopeOfSignRequest', () => {
    it("takes a transaction request's scope from its transactions", () => {
        const transaction = makeUnsignedTransaction('0xFROM')
        const request = {
            ...base,
            type: 'transactions',
            txs: [transaction],
        } as SignRequest

        expect(scopeOfSignRequest(request)).toEqual(transaction.scope)
    })

    it("takes a message request's scope from its message", () => {
        const scope = { chainId: 'ethereum', networkId: 'sepolia' }
        const request = {
            ...base,
            type: 'message',
            message: { scope, method: 'plain', signer: '0xFROM', payload: {} },
        } as unknown as SignRequest

        expect(scopeOfSignRequest(request)).toEqual(scope)
    })

    it.each([
        { type: 'transactions', txs: [] },
        { type: 'arbitrary-data', data: [] },
        { type: 'auth-data', authData: {}, metadata: {} },
    ])(
        'names no network for a $type request stamped with a chain alone',
        shape => {
            const request = {
                ...base,
                ...shape,
                chainId: 'ethereum',
            } as unknown as SignRequest

            expect(scopeOfSignRequest(request)).toBeUndefined()
        },
    )
})
