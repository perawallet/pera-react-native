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
 * Round-trip safe JSON serialization that preserves bigint types.
 * Use with {@link algorandSafeQueryParse} to restore bigint values.
 */
export const algorandSafeQuerySerialize = (value: unknown): string => {
    return JSON.stringify(value, (_key, value) => {
        if (typeof value === 'bigint') {
            return `${BIGINT_TAG}${value.toString()}`
        }
        if (value instanceof Map) {
            return { [MAP_TAG]: Array.from(value.entries()) }
        }
        return value
    })
}

/**
 * Parses JSON produced by {@link algorandSafeQuerySerialize},
 * restoring tagged bigint values.
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
        return value
    })
}
