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

import { Decimal } from 'decimal.js'

/**
 * JSON codec that preserves `Decimal` values end-to-end.
 *
 * Every monetary/precision-sensitive field in the collection layer is typed
 * as `Decimal` (amounts, balances, prices, fees, asset IDs, total supply).
 * When we serialize a collection row to MMKV, these fields must round-trip
 * without precision loss — JS `number` can't be used because values larger
 * than 2^53 (asset IDs, token totals) lose digits.
 *
 * Encoding replaces every `Decimal` with a tagged marker `{ __d: "<string>" }`
 * by walking the object tree *before* `JSON.stringify` sees it. We cannot
 * use the `JSON.stringify` replacer for this because `Decimal.prototype`
 * defines `toJSON()` — `JSON.stringify` calls that first, so by the time
 * the replacer runs the value has already been flattened to a plain
 * string and `value instanceof Decimal` no longer holds.
 *
 * Decoding uses the `JSON.parse` reviver, which has no such complication:
 * the reviver sees the raw parsed nodes and can pattern-match on the
 * marker shape to rehydrate each `Decimal`.
 */

type DecimalMarker = { __d: string }

function isDecimalMarker(value: unknown): value is DecimalMarker {
    if (value === null || typeof value !== 'object') return false
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj)
    return (
        keys.length === 1 && keys[0] === '__d' && typeof obj.__d === 'string'
    )
}

function substituteDecimals(value: unknown): unknown {
    if (value instanceof Decimal) {
        return { __d: value.toString() } satisfies DecimalMarker
    }
    if (Array.isArray(value)) {
        return value.map(substituteDecimals)
    }
    if (value !== null && typeof value === 'object') {
        const out: Record<string, unknown> = {}
        for (const [key, inner] of Object.entries(
            value as Record<string, unknown>,
        )) {
            out[key] = substituteDecimals(inner)
        }
        return out
    }
    return value
}

function reviver(_key: string, value: unknown): unknown {
    if (isDecimalMarker(value)) {
        return new Decimal(value.__d)
    }
    return value
}

export function encode<T>(value: T): string {
    return JSON.stringify(substituteDecimals(value))
}

export function decode<T>(serialized: string): T {
    return JSON.parse(serialized, reviver) as T
}
