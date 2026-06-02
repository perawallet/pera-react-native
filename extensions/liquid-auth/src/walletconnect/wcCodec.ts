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

export type WcRequest = {
    id: number | string
    method: string
    params: unknown[]
}

/** Parse a WalletConnect JSON-RPC request frame. Returns null for anything that
 *  isn't a `{ id, method, params? }` request (negotiation frames, responses,
 *  malformed JSON). */
export const parseWcRequest = (raw: string): WcRequest | null => {
    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch {
        return null
    }
    const env = parsed as { id?: unknown; method?: unknown; params?: unknown }
    const idIsValid = typeof env.id === 'number' || typeof env.id === 'string'
    if (!env || !idIsValid || typeof env.method !== 'string') return null
    return {
        id: env.id as number | string,
        method: env.method,
        params: Array.isArray(env.params) ? env.params : [],
    }
}

export const buildWcResult = (id: number | string, result: unknown): string =>
    JSON.stringify({ id, jsonrpc: '2.0', result })

export const buildWcError = (
    id: number | string,
    code: number,
    message: string,
): string => JSON.stringify({ id, jsonrpc: '2.0', error: { code, message } })
