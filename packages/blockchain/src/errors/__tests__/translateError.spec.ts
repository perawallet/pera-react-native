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
import { LogicError } from '@algorandfoundation/algokit-utils/types/logic-error'
import { toAlgodError } from '../toAlgodError'
import { AlgodError } from '../AlgodError'
import { AlgodErrorCode } from '../algodErrorCodes'

const ADDR = 'GBFKIKHL55YJRTB4PSWXWQJDPHG6IHOLESWSWPPPR6HQ2N7H76RBI5JIT4'
const TXID = 'X4CQTNNARMMELORLYBJY27776Z2453LLREFIZKJYVE3B5FJSL7HA'

describe('toAlgodError', () => {
    test('parses overspend from a thrown Error', () => {
        const raw = new Error(
            `TransactionPool.Remember: transaction ${TXID}: ` +
                `overspend (account ${ADDR}, data {AccountBaseData:{MicroAlgos:{Raw:199000}}}, tried to spend {201000})`,
        )
        const e = toAlgodError(raw)

        expect(e).toBeInstanceOf(AlgodError)
        expect(e.code).toBe(AlgodErrorCode.OVERSPEND)
        expect(e.params).toEqual({
            address: ADDR,
            balance: 199000n,
            spent: 201000n,
            missing: 2000n,
        })
        expect(e.originalError).toBe(raw)
    })

    test('is idempotent — AlgodError in, same AlgodError out', () => {
        const original = new AlgodError('duplicate_txn', { txId: TXID })
        expect(toAlgodError(original)).toBe(original)
    })

    test('falls back to unknown_node_error for unrecognized text and preserves raw', () => {
        const raw = new Error('some totally unfamiliar message')
        const e = toAlgodError(raw)

        expect(e.code).toBe(AlgodErrorCode.UNKNOWN_NODE_ERROR)
        expect(e.params).toEqual({ raw: 'some totally unfamiliar message' })
        expect(e.originalError).toBe(raw)
    })

    test('wraps algokit LogicError with pc/msg/txId from its details', () => {
        const details = {
            txId: TXID,
            pc: 42,
            msg: 'assert failed',
            desc: 'transaction ABC: logic eval error: assert failed. Details: ...',
            traces: [],
        }
        const logicErr = new LogicError(details, ['int 1', 'assert'], () => 2)
        const e = toAlgodError(logicErr)

        expect(e.code).toBe(AlgodErrorCode.LOGIC_ERROR)
        expect(e.params).toMatchObject({
            txId: TXID,
            pc: 42,
            msg: 'assert failed',
        })
        expect(e.originalError).toBe(logicErr)
    })

    test('maps ApiError-shaped 5xx errors to network_unavailable', () => {
        // algokit's ApiError is not publicly exported, so we duck-type it.
        const apiLike = Object.assign(new Error('Bad gateway'), {
            status: 502,
            url: 'https://algod.example/v2/transactions',
            body: { message: 'bad gateway' },
        })
        const e = toAlgodError(apiLike)

        expect(e.code).toBe(AlgodErrorCode.NETWORK_UNAVAILABLE)
        expect(e.params).toMatchObject({
            status: 502,
            url: 'https://algod.example/v2/transactions',
        })
    })

    test('maps fetch-style TypeError to network_unavailable', () => {
        const e = toAlgodError(new TypeError('Network request failed'))
        expect(e.code).toBe(AlgodErrorCode.NETWORK_UNAVAILABLE)
    })

    test('handles non-Error thrown values (strings, undefined) without throwing', () => {
        expect(toAlgodError('a string error').code).toBe(
            AlgodErrorCode.UNKNOWN_NODE_ERROR,
        )
        expect(toAlgodError(undefined).code).toBe(
            AlgodErrorCode.UNKNOWN_NODE_ERROR,
        )
    })

    test('maps a DOMException TimeoutError (AbortSignal.timeout) to retryable network_unavailable', () => {
        const abort = new DOMException(
            'The operation timed out.',
            'TimeoutError',
        )
        const e = toAlgodError(abort)

        expect(e.code).toBe(AlgodErrorCode.NETWORK_UNAVAILABLE)
        expect(e.metadata.retryable).toBe(true)
        expect(e.originalError).toBe(abort)
    })

    test('maps a DOMException AbortError (manual abort) to retryable network_unavailable', () => {
        const abort = new DOMException(
            'The operation was aborted.',
            'AbortError',
        )
        const e = toAlgodError(abort)

        expect(e.code).toBe(AlgodErrorCode.NETWORK_UNAVAILABLE)
        expect(e.metadata.retryable).toBe(true)
        expect(e.originalError).toBe(abort)
    })

    test('retryable flag reflects the code (network_unavailable=true, overspend=false)', () => {
        const network = toAlgodError(
            Object.assign(new Error('upstream timeout'), {
                status: 504,
                url: 'https://algod.example/v2/transactions',
            }),
        )
        expect(network.metadata.retryable).toBe(true)

        const overspend = toAlgodError(
            new Error(
                `overspend (account ${ADDR}, data {MicroAlgos:{Raw:100}}, tried to spend {200})`,
            ),
        )
        expect(overspend.metadata.retryable).toBe(false)
    })
})
