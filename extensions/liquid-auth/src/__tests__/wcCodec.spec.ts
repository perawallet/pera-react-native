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

import { describe, it, expect } from 'vitest'
import {
    parseWcRequest,
    buildWcResult,
    buildWcError,
} from '../walletconnect/wcCodec'

describe('wcCodec', () => {
    it('parses a WC JSON-RPC request', () => {
        const raw = JSON.stringify({
            id: 17,
            jsonrpc: '2.0',
            method: 'algo_signTxn',
            params: [[{ txn: 'b64' }]],
        })
        expect(parseWcRequest(raw)).toEqual({
            id: 17,
            method: 'algo_signTxn',
            params: [[{ txn: 'b64' }]],
        })
    })

    it('returns null for non-WC frames (no id/method) and malformed JSON', () => {
        expect(parseWcRequest(JSON.stringify({ reference: 'x' }))).toBeNull()
        expect(parseWcRequest('not json')).toBeNull()
    })

    it('defaults params to [] when absent', () => {
        const raw = JSON.stringify({
            id: '1',
            jsonrpc: '2.0',
            method: 'session_request',
        })
        expect(parseWcRequest(raw)).toEqual({
            id: '1',
            method: 'session_request',
            params: [],
        })
    })

    it('builds result and error envelopes', () => {
        expect(JSON.parse(buildWcResult(5, ['stxn']))).toEqual({
            id: 5,
            jsonrpc: '2.0',
            result: ['stxn'],
        })
        expect(JSON.parse(buildWcError(6, 4001, 'no'))).toEqual({
            id: 6,
            jsonrpc: '2.0',
            error: { code: 4001, message: 'no' },
        })
    })
})
