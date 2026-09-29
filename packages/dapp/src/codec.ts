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

export const MAX_ERROR_LENGTH = 200
const GENERIC_ERROR_MESSAGE = 'An error occurred during signing'
const GENERIC_REJECT_REASON = 'The user rejected the connection'

/**
 * Errors whose `message` may be relayed verbatim to untrusted web content.
 * Deny-by-default: anything not named here or by the caller gets
 * {@link GENERIC_ERROR_MESSAGE}. `UserCancelledError` is a fixed literal with no
 * interpolation; each chain adapter names its own protocol errors on top.
 *
 * Matched by name rather than `instanceof` deliberately. Importing the classes
 * would pull chain packages into this module, which is bundled into content
 * scripts running on every https page. A rename fails CLOSED (generic copy, no
 * leak), and each chain adapter's spec pins its names to the real classes.
 */
const WEBVIEW_SAFE_ERROR_NAMES: readonly string[] = ['UserCancelledError']

/**
 * This is a JSON-RPC protocol surface exposed to untrusted web content, and is
 * deliberately NOT localized — a protocol response must not vary by user
 * locale.
 */
export const sanitizeErrorForWebview = (
    error: Error,
    relayableNames: readonly string[] = [],
): string => {
    const message =
        WEBVIEW_SAFE_ERROR_NAMES.includes(error.name) ||
        relayableNames.includes(error.name)
            ? error.message
            : GENERIC_ERROR_MESSAGE
    return message.length > MAX_ERROR_LENGTH
        ? message.slice(0, MAX_ERROR_LENGTH)
        : message
}

/**
 * A connect rejection carries the wallet's own reason, but the approval surface
 * can forward an arbitrary `Error.message` into it, so it is bounded like every
 * other page-bound string rather than crossing verbatim. Control characters go
 * because the page renders this text.
 */
export const sanitizeRejectReason = (reason: string | undefined): string => {
    const cleaned = reason?.replace(/\p{C}/gu, ' ').trim()
    return cleaned ? cleaned.slice(0, MAX_ERROR_LENGTH) : GENERIC_REJECT_REASON
}

export const JsonRpcErrorCode = {
    ParseError: -32_700,
    InvalidRequest: -32_600,
    MethodNotFound: -32_601,
    InvalidParams: -32_602,
    InternalError: -32_603,
    ServerErrorStart: -32_000,
    Unauthorized: -32_001,
    UserRejected: -32_002,
    NetworkNotSupported: -32_003,
    RequestTimedOut: -32_004,
    ServerErrorEnd: -32_099,
} as const
export type JsonRpcErrorCode =
    (typeof JsonRpcErrorCode)[keyof typeof JsonRpcErrorCode]

export type JsonRpcId = string | number
export type JsonRpcRequest = {
    jsonrpc: '2.0'
    id: JsonRpcId
    method: string
    params?: unknown
}
export type JsonRpcNotification = {
    jsonrpc: '2.0'
    method: string
    params?: unknown
}
export type JsonRpcErrorObject = {
    code: number
    message: string
    data?: unknown
}
export type JsonRpcResponse = { jsonrpc: '2.0'; id: JsonRpcId } & (
    | { result: unknown }
    | { error: JsonRpcErrorObject }
)

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null
const isId = (value: unknown): value is JsonRpcId =>
    typeof value === 'string' || typeof value === 'number'

export const isJsonRpcRequest = (value: unknown): value is JsonRpcRequest =>
    isRecord(value) &&
    value.jsonrpc === '2.0' &&
    isId(value.id) &&
    typeof value.method === 'string'

export const isJsonRpcNotification = (
    value: unknown,
): value is JsonRpcNotification =>
    isRecord(value) &&
    value.jsonrpc === '2.0' &&
    !('id' in value) &&
    typeof value.method === 'string'

export const isJsonRpcResponse = (value: unknown): value is JsonRpcResponse => {
    if (!isRecord(value) || value.jsonrpc !== '2.0' || !isId(value.id))
        return false
    if ('result' in value) return true
    return (
        isRecord(value.error) &&
        typeof value.error.code === 'number' &&
        typeof value.error.message === 'string'
    )
}

export const jsonRpcResult = (
    id: JsonRpcId,
    result: unknown,
): JsonRpcResponse => ({
    jsonrpc: '2.0',
    id,
    result,
})

export const jsonRpcError = (
    id: JsonRpcId,
    code: number,
    message: string,
    data?: unknown,
): JsonRpcResponse => ({
    jsonrpc: '2.0',
    id,
    error: data === undefined ? { code, message } : { code, message, data },
})
