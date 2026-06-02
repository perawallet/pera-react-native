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
 * Minimal definite-length CBOR (RFC 8949) codec shared by the two CBOR
 * consumers in this extension:
 *
 * - WebAuthn attestation (COSE keys, attestation objects): maps with
 *   significant entry order and integer keys — use {@link cborEncodeMap}.
 * - The ARC-0027 data-channel transport: plain JS values where string-keyed
 *   objects become maps — use {@link cborEncode} / {@link cborDecode}.
 *
 * Covers unsigned/negative integers, byte strings, text strings, arrays,
 * maps, booleans, null and undefined.
 */

import { concatBytes } from './bytes'

/** An ordered CBOR map: list of [key, value] entries encoded in order. */
export type CborMap = ReadonlyArray<readonly [CborValue, CborValue]>

/** Wraps already-encoded CBOR bytes so they are embedded verbatim. */
export type CborRaw = { readonly __cborRaw: Uint8Array }

export type CborValue =
    | number
    | string
    | boolean
    | null
    | undefined
    | Uint8Array
    | CborRaw
    | ReadonlyArray<CborValue>
    | { readonly [key: string]: CborValue }

/** Mark pre-encoded CBOR bytes for verbatim embedding (e.g. an empty map). */
export const cborRaw = (bytes: Uint8Array): CborRaw => ({ __cborRaw: bytes })

const isCborRaw = (value: object): value is CborRaw => '__cborRaw' in value

const MAJOR_UNSIGNED = 0
const MAJOR_NEGATIVE = 1
const MAJOR_BYTES = 2
const MAJOR_TEXT = 3
const MAJOR_ARRAY = 4
const MAJOR_MAP = 5
const MAJOR_SIMPLE = 7

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

/**
 * Encode a value as definite-length CBOR. Plain objects become string-keyed
 * maps with `undefined`-valued keys omitted (JSON.stringify parity); arrays
 * always encode as CBOR arrays. For maps with significant entry order or
 * non-string keys use {@link cborEncodeMap}.
 */
export const cborEncode = (value: unknown): Uint8Array => {
    if (value === null || value === undefined) {
        return new Uint8Array([0xf6]) // null
    }
    if (typeof value === 'boolean') {
        return new Uint8Array([value ? 0xf5 : 0xf4])
    }
    if (typeof value === 'number') {
        return encodeNumber(value)
    }
    if (typeof value === 'string') {
        const bytes = new TextEncoder().encode(value)
        return concatBytes([encodeHead(MAJOR_TEXT, bytes.length), bytes])
    }
    if (value instanceof Uint8Array) {
        return concatBytes([encodeHead(MAJOR_BYTES, value.length), value])
    }
    if (Array.isArray(value)) {
        const chunks = [encodeHead(MAJOR_ARRAY, value.length)]
        for (const item of value) chunks.push(cborEncode(item))
        return concatBytes(chunks)
    }
    if (typeof value === 'object') {
        if (isCborRaw(value)) {
            return value.__cborRaw
        }
        const entries = Object.entries(value as Record<string, unknown>).filter(
            ([, v]) => v !== undefined,
        )
        return cborEncodeMap(entries as CborMap)
    }
    throw new Error(`cbor: unsupported value type ${typeof value}`)
}

/** Encode an ordered map from explicit [key, value] entries. */
export const cborEncodeMap = (entries: CborMap): Uint8Array => {
    const chunks = [encodeHead(MAJOR_MAP, entries.length)]
    for (const [key, mapValue] of entries) {
        chunks.push(cborEncode(key))
        chunks.push(cborEncode(mapValue))
    }
    return concatBytes(chunks)
}

class CborReader {
    private offset = 0
    constructor(private readonly bytes: Uint8Array) {}

    private u8(): number {
        if (this.offset >= this.bytes.length) {
            throw new Error('cbor: unexpected end of input')
        }
        return this.bytes[this.offset++]
    }

    private readArgument(info: number): number {
        if (info < 24) return info
        if (info === 24) return this.u8()
        if (info === 25) return (this.u8() << 8) | this.u8()
        if (info === 26) {
            return (
                this.u8() * 0x1000000 +
                (this.u8() << 16) +
                (this.u8() << 8) +
                this.u8()
            )
        }
        if (info === 27) {
            // 8-byte: combine as a JS number (safe for the sizes ARC-0027 uses).
            let value = 0
            for (let i = 0; i < 8; i++) value = value * 256 + this.u8()
            return value
        }
        throw new Error(`cbor: unsupported additional info ${info}`)
    }

    private readBytes(length: number): Uint8Array {
        if (this.offset + length > this.bytes.length) {
            throw new Error('cbor: byte string overruns input')
        }
        const slice = this.bytes.subarray(this.offset, this.offset + length)
        this.offset += length
        return slice
    }

    read(): unknown {
        const initial = this.u8()
        const major = initial >> 5
        const info = initial & 0x1f

        switch (major) {
            case MAJOR_UNSIGNED:
                return this.readArgument(info)
            case MAJOR_NEGATIVE:
                return -1 - this.readArgument(info)
            case MAJOR_BYTES:
                return this.readBytes(this.readArgument(info))
            case MAJOR_TEXT:
                return new TextDecoder().decode(
                    this.readBytes(this.readArgument(info)),
                )
            case MAJOR_ARRAY: {
                const length = this.readArgument(info)
                const arr: unknown[] = []
                for (let i = 0; i < length; i++) arr.push(this.read())
                return arr
            }
            case MAJOR_MAP: {
                const length = this.readArgument(info)
                const obj: Record<string, unknown> = {}
                for (let i = 0; i < length; i++) {
                    const key = this.read()
                    obj[String(key)] = this.read()
                }
                return obj
            }
            case MAJOR_SIMPLE:
                if (info === 20) return false
                if (info === 21) return true
                if (info === 22) return null
                if (info === 23) return undefined
                throw new Error(`cbor: unsupported simple value ${info}`)
            default:
                throw new Error(`cbor: unsupported major type ${major}`)
        }
    }
}

/** Decode definite-length CBOR bytes to a plain JS value. */
export const cborDecode = (bytes: Uint8Array): unknown =>
    new CborReader(bytes).read()
