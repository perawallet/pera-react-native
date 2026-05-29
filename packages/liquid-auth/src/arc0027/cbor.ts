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
 * Minimal definite-length CBOR (RFC 8949) encoder + decoder for the ARC-0027
 * data-channel transport. dApps (avm-web-provider / use-wallet's Liquid
 * provider) frame ARC-0027 messages as CBOR, base64-encoded, over the WebRTC
 * data channel — NOT JSON. Covers the value types those envelopes use:
 * unsigned/negative integers, byte strings, text strings, arrays, maps
 * (string-keyed → plain objects), booleans and null.
 *
 * The existing `extensions/.../webauthn/cbor.ts` encoder is COSE-specific
 * (ordered [key,value] entries, integer keys, encode-only), so this is a
 * separate plain-JS codec for the wallet-RPC layer.
 */

const MAJOR_UNSIGNED = 0
const MAJOR_NEGATIVE = 1
const MAJOR_BYTES = 2
const MAJOR_TEXT = 3
const MAJOR_ARRAY = 4
const MAJOR_MAP = 5
const MAJOR_SIMPLE = 7

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

/** Type byte + argument (length for strings/arrays/maps, or the integer value). */
const encodeHead = (major: number, argument: number): Uint8Array => {
    const initial = major << 5
    if (argument < 24) return new Uint8Array([initial | argument])
    if (argument <= 0xff) return new Uint8Array([initial | 24, argument])
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

/** Encode a plain JS value as definite-length CBOR. */
export const cborEncode = (value: unknown): Uint8Array => {
    if (value === null || value === undefined) {
        return new Uint8Array([0xf6]) // null
    }
    if (typeof value === 'boolean') {
        return new Uint8Array([value ? 0xf5 : 0xf4])
    }
    if (typeof value === 'number') {
        if (!Number.isInteger(value)) {
            throw new Error(`cbor: only integers supported, got ${value}`)
        }
        return value >= 0
            ? encodeHead(MAJOR_UNSIGNED, value)
            : encodeHead(MAJOR_NEGATIVE, -1 - value)
    }
    if (typeof value === 'string') {
        const bytes = new TextEncoder().encode(value)
        return concat([encodeHead(MAJOR_TEXT, bytes.length), bytes])
    }
    if (value instanceof Uint8Array) {
        return concat([encodeHead(MAJOR_BYTES, value.length), value])
    }
    if (Array.isArray(value)) {
        const chunks = [encodeHead(MAJOR_ARRAY, value.length)]
        for (const item of value) chunks.push(cborEncode(item))
        return concat(chunks)
    }
    if (typeof value === 'object') {
        // Omit undefined-valued keys (JSON.stringify parity).
        const entries = Object.entries(value as Record<string, unknown>).filter(
            ([, v]) => v !== undefined,
        )
        const chunks = [encodeHead(MAJOR_MAP, entries.length)]
        for (const [key, mapValue] of entries) {
            chunks.push(cborEncode(key))
            chunks.push(cborEncode(mapValue))
        }
        return concat(chunks)
    }
    throw new Error(`cbor: unsupported value type ${typeof value}`)
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
