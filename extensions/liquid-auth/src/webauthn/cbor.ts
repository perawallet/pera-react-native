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

/**
 * Minimal definite-length CBOR (RFC 8949) encoder covering only the subset
 * required for WebAuthn attestation: unsigned/negative integers, byte strings,
 * text strings, arrays and maps.
 *
 * Maps are represented as an ordered array of `[key, value]` entries rather
 * than a JS object: COSE key order is significant and integer keys are
 * required, neither of which a plain object can express reliably.
 */

/** An ordered CBOR map: list of [key, value] entries encoded in order. */
export type CborMap = ReadonlyArray<readonly [CborValue, CborValue]>

/** Wraps already-encoded CBOR bytes so they are embedded verbatim. */
export type CborRaw = { readonly __cborRaw: Uint8Array }

export type CborValue =
    | number
    | Uint8Array
    | string
    | CborRaw
    | ReadonlyArray<CborValue>
    | CborMap

/** Mark pre-encoded CBOR bytes for verbatim embedding (e.g. an empty map). */
export const cborRaw = (bytes: Uint8Array): CborRaw => ({ __cborRaw: bytes })

const isCborRaw = (value: CborValue): value is CborRaw =>
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Uint8Array) &&
    '__cborRaw' in value

const MAJOR_UNSIGNED = 0
const MAJOR_NEGATIVE = 1
const MAJOR_BYTES = 2
const MAJOR_TEXT = 3
const MAJOR_ARRAY = 4
const MAJOR_MAP = 5

/**
 * Encode the type byte plus argument for a major type. `argument` is the
 * length (for strings/arrays/maps) or the integer value (for ints), and must
 * be a non-negative safe integer.
 */
const encodeHead = (major: number, argument: number): Uint8Array => {
    if (!Number.isInteger(argument) || argument < 0) {
        throw new Error(`cbor: invalid head argument ${argument}`)
    }
    const initial = major << 5
    if (argument < 24) {
        return new Uint8Array([initial | argument])
    }
    if (argument <= 0xff) {
        return new Uint8Array([initial | 24, argument])
    }
    if (argument <= 0xffff) {
        return new Uint8Array([
            initial | 25,
            (argument >> 8) & 0xff,
            argument & 0xff,
        ])
    }
    if (argument <= 0xffffffff) {
        return new Uint8Array([
            initial | 26,
            (argument >>> 24) & 0xff,
            (argument >>> 16) & 0xff,
            (argument >>> 8) & 0xff,
            argument & 0xff,
        ])
    }
    // 8-byte length. JS bitwise ops are 32-bit, so split into high/low halves.
    const high = Math.floor(argument / 0x100000000)
    const low = argument % 0x100000000
    return new Uint8Array([
        initial | 27,
        (high >>> 24) & 0xff,
        (high >>> 16) & 0xff,
        (high >>> 8) & 0xff,
        high & 0xff,
        (low >>> 24) & 0xff,
        (low >>> 16) & 0xff,
        (low >>> 8) & 0xff,
        low & 0xff,
    ])
}

const concat = (chunks: Uint8Array[]): Uint8Array => {
    let total = 0
    for (const chunk of chunks) total += chunk.length
    const out = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
        out.set(chunk, offset)
        offset += chunk.length
    }
    return out
}

const isMapEntries = (value: ReadonlyArray<CborValue>): boolean =>
    value.length > 0 &&
    value.every(
        entry =>
            Array.isArray(entry) &&
            entry.length === 2 &&
            // Distinguish a [key, value] entry from a nested CBOR array of two
            // values: entries are 2-tuples whose first element is a CBOR key
            // type (number, string or Uint8Array), never an array/map.
            !Array.isArray((entry as readonly CborValue[])[0]),
    )

const encodeNumber = (value: number): Uint8Array => {
    if (!Number.isInteger(value)) {
        throw new Error(`cbor: only integers supported, got ${value}`)
    }
    if (value >= 0) {
        return encodeHead(MAJOR_UNSIGNED, value)
    }
    // Negative integers encode -(n+1), i.e. value = -1 - argument.
    return encodeHead(MAJOR_NEGATIVE, -1 - value)
}

/** Encode a value as definite-length CBOR. */
export const cborEncode = (value: CborValue): Uint8Array => {
    if (typeof value === 'number') {
        return encodeNumber(value)
    }
    if (value instanceof Uint8Array) {
        return concat([encodeHead(MAJOR_BYTES, value.length), value])
    }
    if (isCborRaw(value)) {
        return value.__cborRaw
    }
    if (typeof value === 'string') {
        const bytes = new TextEncoder().encode(value)
        return concat([encodeHead(MAJOR_TEXT, bytes.length), bytes])
    }
    if (Array.isArray(value)) {
        if (isMapEntries(value)) {
            return encodeMap(value as CborMap)
        }
        const items = value as ReadonlyArray<CborValue>
        const chunks = [encodeHead(MAJOR_ARRAY, items.length)]
        for (const item of items) chunks.push(cborEncode(item))
        return concat(chunks)
    }
    throw new Error('cbor: unsupported value type')
}

const encodeMap = (entries: CborMap): Uint8Array => {
    const chunks = [encodeHead(MAJOR_MAP, entries.length)]
    for (const [key, mapValue] of entries) {
        chunks.push(cborEncode(key))
        chunks.push(cborEncode(mapValue))
    }
    return concat(chunks)
}

/** Encode an ordered map explicitly (use when the array could be empty). */
export const cborEncodeMap = (entries: CborMap): Uint8Array =>
    encodeMap(entries)
