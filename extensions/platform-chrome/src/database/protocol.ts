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

// Wire protocol between UI/background contexts and the offscreen DB host.
// chrome.runtime messages are JSON-serialized (NOT structured-cloned), so
// non-JSON values are tagged. Current schemas hold only text/integer/real
// columns (packages/*/src/db/schema.ts) — the tags are safety for future
// blob/bigint columns, mirroring the RN driver's Uint8Array tolerance
// (extensions/platform-react-native/src/services/database.ts bindParams).

export const DB_SCOPE = 'pera-db'
export const DB_CONTROL_SCOPE = 'pera-db-control'

export type DbMethod = 'run' | 'all' | 'values' | 'get'

export type DbExecMessage = {
    scope: typeof DB_SCOPE
    kind: 'exec'
    name: string
    sql: string
    params: unknown[]
    method: DbMethod
}

export type DbPingMessage = { scope: typeof DB_SCOPE; kind: 'ping' }

export type DbDeleteMessage = {
    scope: typeof DB_SCOPE
    kind: 'delete'
    name: string
}

export type DbMessage = DbExecMessage | DbPingMessage | DbDeleteMessage

export type DbExecResponse =
    | { ok: true; rows: unknown[][] }
    | { ok: false; code: 'not-ready' | 'exec-failed'; error: string }

export type DbPingResponse = { ok: true; ready: boolean }

export type EnsureOffscreenMessage = {
    scope: typeof DB_CONTROL_SCOPE
    kind: 'ensure-offscreen'
}

export const isDbMessage = (message: unknown): message is DbMessage =>
    typeof message === 'object' &&
    message !== null &&
    (message as DbMessage).scope === DB_SCOPE

const toBase64 = (bytes: Uint8Array): string => {
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
}

const fromBase64 = (base64: string): Uint8Array =>
    Uint8Array.from(atob(base64), char => char.charCodeAt(0))

export const encodeWireValues = (values: unknown[]): unknown[] =>
    values.map(value => {
        if (value === undefined) return null
        if (value instanceof Uint8Array) return { __pera_u8: toBase64(value) }
        if (typeof value === 'bigint') return { __pera_bigint: String(value) }
        return value
    })

export const decodeWireValues = (values: unknown[]): unknown[] =>
    values.map(value => {
        if (typeof value === 'object' && value !== null) {
            const tagged = value as {
                __pera_u8?: string
                __pera_bigint?: string
            }
            if (typeof tagged.__pera_u8 === 'string') {
                return fromBase64(tagged.__pera_u8)
            }
            if (typeof tagged.__pera_bigint === 'string') {
                return BigInt(tagged.__pera_bigint)
            }
        }
        return value
    })
