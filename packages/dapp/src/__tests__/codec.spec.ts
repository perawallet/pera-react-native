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
import {
    JsonRpcErrorCode,
    isJsonRpcNotification,
    isJsonRpcRequest,
    isJsonRpcResponse,
    jsonRpcError,
    jsonRpcResult,
} from '../codec'

describe('JSON-RPC codec', () => {
    it('recognises a request and rejects a notification as a request', () => {
        expect(
            isJsonRpcRequest({ jsonrpc: '2.0', id: 'a', method: 'connect' }),
        ).toBe(true)
        expect(
            isJsonRpcRequest({
                jsonrpc: '2.0',
                id: 7,
                method: 'x',
                params: {},
            }),
        ).toBe(true)
        expect(isJsonRpcRequest({ jsonrpc: '2.0', method: 'connect' })).toBe(
            false,
        )
        expect(isJsonRpcRequest({ jsonrpc: '1.0', id: 'a', method: 'x' })).toBe(
            false,
        )
        expect(isJsonRpcRequest(null)).toBe(false)
    })

    it('recognises a notification (no id) and a response (result or error)', () => {
        expect(
            isJsonRpcNotification({ jsonrpc: '2.0', method: 'disconnect' }),
        ).toBe(true)
        expect(
            isJsonRpcNotification({ jsonrpc: '2.0', id: 'a', method: 'x' }),
        ).toBe(false)
        expect(isJsonRpcResponse(jsonRpcResult('a', null))).toBe(true)
        expect(isJsonRpcResponse(jsonRpcError('a', -1, 'no'))).toBe(true)
        expect(isJsonRpcResponse({ jsonrpc: '2.0', id: 'a' })).toBe(false)
        expect(
            isJsonRpcResponse({
                jsonrpc: '2.0',
                id: 'a',
                error: { code: 'x' },
            }),
        ).toBe(false)
    })

    it('builds result and error envelopes carrying the request id', () => {
        expect(jsonRpcResult(3, [1])).toEqual({
            jsonrpc: '2.0',
            id: 3,
            result: [1],
        })
        expect(
            jsonRpcError('r', JsonRpcErrorCode.UserRejected, 'nope', { a: 1 }),
        ).toEqual({
            jsonrpc: '2.0',
            id: 'r',
            error: { code: -32_002, message: 'nope', data: { a: 1 } },
        })
        expect(jsonRpcError('r', JsonRpcErrorCode.Unauthorized, 'x')).toEqual({
            jsonrpc: '2.0',
            id: 'r',
            error: { code: -32_001, message: 'x' },
        })
    })
})
