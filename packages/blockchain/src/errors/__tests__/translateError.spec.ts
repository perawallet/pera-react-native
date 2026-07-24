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
import { PeraNetworkError } from '@perawallet/wallet-core-shared'
import { toAlgodError } from '../toAlgodError'
import { AlgodError } from '../AlgodError'
import { AlgodErrorCode } from '../algodErrorCodes'

const ADDR = 'GBFKIKHL55YJRTB4PSWXWQJDPHG6IHOLESWSWPPPR6HQ2N7H76RBI5JIT4'
const TXID = 'X4CQTNNARMMELORLYBJY27776Z2453LLREFIZKJYVE3B5FJSL7HA'

// Mirrors what algosdk v3's URLTokenBaseHTTPError (+ HTTPClient.prepareResponseError)
// actually throws: a plain Error carrying a numeric `status` and a `response`
// with the decoded body text, and — crucially — NO `url`. The node's body
// message is also appended to the error `message`, exactly as algosdk does.
// Building the real shape is what guards against the PERA-4502 regression,
// where the guard required a v10-only `url` and never matched.
const makeAlgodHttpError = ({
    status,
    statusText = '',
    bodyMessage,
}: {
    status: number
    statusText?: string
    bodyMessage?: string
}): Error => {
    const message =
        `Network request error. Received status ${status} (${statusText})` +
        (bodyMessage ? `: ${bodyMessage}` : '')
    const text = bodyMessage ? JSON.stringify({ message: bodyMessage }) : ''
    return Object.assign(new Error(message), {
        name: 'URLTokenBaseHTTPError',
        status,
        response: {
            status,
            text,
            body: new TextEncoder().encode(text),
        },
    })
}

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

    test('parses a logic eval error rejection from a thrown Error', () => {
        const raw = new Error(
            `TransactionPool.Remember: transaction ${TXID}: ` +
                'logic eval error: assert failed pc=1234. Details: app=2449590623, pc=1234, opcodes=intc_1; assert',
        )
        const e = toAlgodError(raw)

        expect(e).toBeInstanceOf(AlgodError)
        expect(e.code).toBe(AlgodErrorCode.LOGIC_EVAL_ERROR)
        expect(e.params).toEqual({
            appId: 2449590623n,
            detail: 'assert failed pc=1234',
        })
        expect(e.originalError).toBe(raw)
    })

    test('parses an unavailable-resource rejection from a thrown Error', () => {
        const raw = new Error(
            `logic eval error: unavailable Asset 31566704. Details: pc=42`,
        )
        const e = toAlgodError(raw)

        expect(e).toBeInstanceOf(AlgodError)
        expect(e.code).toBe(AlgodErrorCode.UNAVAILABLE_RESOURCE)
        expect(e.params).toEqual({
            resourceType: 'Asset',
            resource: '31566704',
        })
        expect(e.originalError).toBe(raw)
    })

    test('parses a group-fee-too-small rejection from a thrown Error', () => {
        const raw = new Error(
            'TransactionPool.Remember: txgroup had 4000 in fees, which is less than the minimum number of transactions per group * minFee (6 * 1000 = 6000)',
        )
        const e = toAlgodError(raw)

        expect(e).toBeInstanceOf(AlgodError)
        expect(e.code).toBe(AlgodErrorCode.GROUP_FEE_TOO_SMALL)
        expect(e.params).toEqual({ paid: 4000n, required: 6000n })
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

    // Reachability guard for `fromApiError`: network_unavailable is only ever
    // produced for a >=500/0 status via that branch (never by parseAlgodMessage
    // or the fetch/abort guards). If the duck-type guard breaks again, a 5xx
    // http error falls through to unknown_node_error and these fail.
    test.each([502, 503, 0])(
        'maps a status-%i algod http error (algosdk v3 shape, no url) to network_unavailable',
        status => {
            const err = makeAlgodHttpError({
                status,
                statusText: 'Bad Gateway',
            })
            const e = toAlgodError(err)

            expect(e.code).toBe(AlgodErrorCode.NETWORK_UNAVAILABLE)
            expect(e.params).toMatchObject({ status })
            expect(e.metadata.retryable).toBe(true)
            expect(e.originalError).toBe(err)
        },
    )

    test('classifies a 400 overspend carried on an algosdk v3 http error through fromApiError', () => {
        const bodyMessage =
            `TransactionPool.Remember: transaction ${TXID}: ` +
            `overspend (account ${ADDR}, data {AccountBaseData:{MicroAlgos:{Raw:199000}}}, tried to spend {201000})`
        const err = makeAlgodHttpError({
            status: 400,
            statusText: 'Bad Request',
            bodyMessage,
        })
        const e = toAlgodError(err)

        expect(e.code).toBe(AlgodErrorCode.OVERSPEND)
        expect(e.params).toMatchObject({
            address: ADDR,
            balance: 199000n,
            spent: 201000n,
            missing: 2000n,
        })
        expect(e.originalError).toBe(err)
    })

    // A bare numeric `status` is not enough to be an algod http error: the Pera
    // backend's PeraNetworkError also carries one, and classifying it as
    // network_unavailable renders the offline copy for a backend outage while
    // the device is online. The guard must require the algosdk `response` too.
    test('does not classify a PeraNetworkError backend 5xx as an algod network error', () => {
        const err = new PeraNetworkError('server', { status: 503 })
        const e = toAlgodError(err)

        expect(e.code).toBe(AlgodErrorCode.UNKNOWN_NODE_ERROR)
        expect(e.originalError).toBe(err)
    })

    test('unwraps the JSON body message into unknown_node_error raw for unclassified 4xx', () => {
        const err = makeAlgodHttpError({
            status: 404,
            statusText: 'Not Found',
            bodyMessage: `account ${ADDR} not found`,
        })
        const e = toAlgodError(err)

        expect(e.code).toBe(AlgodErrorCode.UNKNOWN_NODE_ERROR)
        expect(e.params).toMatchObject({ raw: `account ${ADDR} not found` })
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
            makeAlgodHttpError({ status: 504, statusText: 'Gateway Timeout' }),
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
