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
import { ARC0001_MAX_TXN_B64_LENGTH } from '@perawallet/wallet-core-blockchain'
import { MAX_TRANSACTION_SIGN_REQUESTS } from '@perawallet/wallet-core-signing'
import { isWithinDappPayloadBounds } from '../bounds'
import type { JsonRpcRequest } from '../codec'
import { MAX_DAPP_REQUEST_JSON_LENGTH } from '../protocol'

const req = (
    method: string,
    params?: unknown,
    id: string | number = 'r',
): JsonRpcRequest => ({
    jsonrpc: '2.0',
    id,
    method,
    params,
})

describe('isWithinDappPayloadBounds', () => {
    it('accepts a small well-formed sign request', () => {
        expect(
            isWithinDappPayloadBounds(
                req('requestTransactionSigning', { txns: [{ txn: 'AA==' }] }),
            ),
        ).toBe(true)
    })

    it('accepts a non-signing request without inspecting its params', () => {
        expect(
            isWithinDappPayloadBounds(
                req('connect', { networks: ['mainnet'], foo: { bar: 1 } }),
            ),
        ).toBe(true)
    })

    it('accepts an id and a method name of exactly the cap', () => {
        expect(
            isWithinDappPayloadBounds(
                req('connect', undefined, 'x'.repeat(64)),
            ),
        ).toBe(true)
        expect(isWithinDappPayloadBounds(req('m'.repeat(64)))).toBe(true)
    })

    it('accepts the largest permitted transaction count and base64 length', () => {
        const atCap = Array.from(
            { length: MAX_TRANSACTION_SIGN_REQUESTS },
            () => ({ txn: 'AA==' }),
        )
        expect(
            isWithinDappPayloadBounds(
                req('requestTransactionSigning', { txns: atCap }),
            ),
        ).toBe(true)
        expect(
            isWithinDappPayloadBounds(
                req('requestTransactionSigning', {
                    txns: [{ txn: 'A'.repeat(ARC0001_MAX_TXN_B64_LENGTH) }],
                }),
            ),
        ).toBe(true)
    })

    it('rejects an oversized id or method name', () => {
        expect(
            isWithinDappPayloadBounds(
                req('connect', undefined, 'x'.repeat(65)),
            ),
        ).toBe(false)
        expect(isWithinDappPayloadBounds(req('m'.repeat(65)))).toBe(false)
    })

    it('rejects too many transactions or a transaction over the base64 cap', () => {
        const many = Array.from(
            { length: MAX_TRANSACTION_SIGN_REQUESTS + 1 },
            () => ({ txn: 'AA==' }),
        )
        expect(
            isWithinDappPayloadBounds(
                req('requestTransactionSigning', { txns: many }),
            ),
        ).toBe(false)
        expect(
            isWithinDappPayloadBounds(
                req('requestTransactionSigning', {
                    txns: [{ txn: 'A'.repeat(ARC0001_MAX_TXN_B64_LENGTH + 1) }],
                }),
            ),
        ).toBe(false)
    })

    it('rejects an empty or malformed txns array', () => {
        expect(
            isWithinDappPayloadBounds(
                req('requestTransactionSigning', { txns: [] }),
            ),
        ).toBe(false)
        expect(
            isWithinDappPayloadBounds(
                req('requestTransactionSigning', { txns: ['AA=='] }),
            ),
        ).toBe(false)
        expect(
            isWithinDappPayloadBounds(req('requestTransactionSigning', {})),
        ).toBe(false)
    })

    it('rejects any request whose JSON exceeds the blanket cap by one byte', () => {
        const padding = (length: number): JsonRpcRequest =>
            req('requestDataSigning', {
                data: [{ signer: 'A', data: 'x'.repeat(length) }],
            })
        const overhead = JSON.stringify(padding(0)).length
        const atCap = padding(MAX_DAPP_REQUEST_JSON_LENGTH - overhead)

        expect(JSON.stringify(atCap).length).toBe(MAX_DAPP_REQUEST_JSON_LENGTH)
        expect(isWithinDappPayloadBounds(atCap)).toBe(true)
        expect(
            isWithinDappPayloadBounds(
                padding(MAX_DAPP_REQUEST_JSON_LENGTH - overhead + 1),
            ),
        ).toBe(false)
    })
})
