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

import { encodeAlgorandAddress } from './addresses'

const BIGINT_TAG = '__bigint__'
const MAP_TAG = '__map__'
const BYTES_TAG = '__bytes__'

export const algorandSafeJsonStringify = (value: unknown) => {
    return JSON.stringify(
        value,
        (key, value) => {
            if (key === 'publicKey') {
                return encodeAlgorandAddress(value)
            }
            if (typeof value === 'bigint') {
                if (value > Number.MAX_SAFE_INTEGER) {
                    return value.toString()
                }
                return Number(value)
            }
            if (value instanceof Uint8Array) {
                return Buffer.from(value).toString('base64')
            }
            return value
        },
        4,
    )
}

/**
 * Round-trip safe JSON serialization that preserves bigint, Map and Uint8Array types.
 * Use with {@link algorandSafeQueryParse} to restore them.
 */
export const algorandSafeQuerySerialize = (value: unknown): string => {
    // JSON.stringify applies toJSON before the replacer, and Buffer has one, so a
    // replacer reading its `value` argument sees {type:'Buffer',data:[...]} and never
    // recognizes the bytes. Read the raw pre-toJSON value off the holder instead.
    return JSON.stringify(value, function (key, value) {
        const raw = (this as Record<string, unknown>)[key]
        if (typeof raw === 'bigint') {
            return `${BIGINT_TAG}${raw.toString()}`
        }
        if (raw instanceof Map) {
            return { [MAP_TAG]: Array.from(raw.entries()) }
        }
        // Buffer reports [object Uint8Array] too, and unlike `instanceof` the tag
        // survives the realm split between Node's Buffer and jsdom's Uint8Array
        // under vitest — while still excluding Int32Array and DataView, which must
        // not be re-typed as bytes.
        if (Object.prototype.toString.call(raw) === '[object Uint8Array]') {
            return {
                [BYTES_TAG]: Buffer.from(
                    raw as Uint8Array<ArrayBufferLike>,
                ).toString('base64'),
            }
        }
        return value
    })
}

/**
 * Parses JSON produced by {@link algorandSafeQuerySerialize},
 * restoring tagged bigint, Map and Uint8Array values.
 */
export const algorandSafeQueryParse = <T = unknown>(data: string): T => {
    return JSON.parse(data, (_key, value) => {
        if (typeof value === 'string' && value.startsWith(BIGINT_TAG)) {
            return BigInt(value.slice(BIGINT_TAG.length))
        }
        if (
            value !== null &&
            typeof value === 'object' &&
            MAP_TAG in value &&
            Array.isArray(value[MAP_TAG])
        ) {
            return new Map(value[MAP_TAG])
        }
        if (
            value !== null &&
            typeof value === 'object' &&
            BYTES_TAG in value &&
            typeof value[BYTES_TAG] === 'string'
        ) {
            return new Uint8Array(Buffer.from(value[BYTES_TAG], 'base64'))
        }
        return value
    })
}
