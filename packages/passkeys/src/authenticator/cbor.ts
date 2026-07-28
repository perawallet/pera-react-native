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

import { concatBytes } from '@perawallet/wallet-core-shared'

/**
 * Minimal CBOR encoder covering exactly the shapes WebAuthn attestation
 * objects and COSE keys need: unsigned/negative integers, byte strings, text
 * strings, and (definite-length) maps. Byte-for-byte port of the private
 * `Cbor` enum in `PasskeyAutofillCredentialProvider/WebAuthn.swift` — any
 * change here must stay in lockstep with that file so iOS/Android/extension
 * authenticators produce identical attestation bytes.
 */

const MAJOR_TYPE_UNSIGNED_INT = 0
const MAJOR_TYPE_NEGATIVE_INT = 1
const MAJOR_TYPE_BYTE_STRING = 2
const MAJOR_TYPE_TEXT_STRING = 3
const MAJOR_TYPE_MAP = 5

const encodeUnsigned = (value: number, majorType: number): Uint8Array => {
    const prefix = majorType << 5
    if (value < 24) {
        return Uint8Array.from([prefix | value])
    }
    if (value < 256) {
        return Uint8Array.from([prefix | 24, value])
    }
    if (value < 65_536) {
        return Uint8Array.from([prefix | 25, (value >> 8) & 0xff, value & 0xff])
    }
    if (value < 4_294_967_296) {
        return Uint8Array.from([
            prefix | 26,
            (value >>> 24) & 0xff,
            (value >>> 16) & 0xff,
            (value >>> 8) & 0xff,
            value & 0xff,
        ])
    }
    const big = BigInt(value)
    return Uint8Array.from([
        prefix | 27,
        Number((big >> 56n) & 0xffn),
        Number((big >> 48n) & 0xffn),
        Number((big >> 40n) & 0xffn),
        Number((big >> 32n) & 0xffn),
        Number((big >> 24n) & 0xffn),
        Number((big >> 16n) & 0xffn),
        Number((big >> 8n) & 0xffn),
        Number(big & 0xffn),
    ])
}

/** Encodes a signed CBOR integer: non-negative → major type 0, negative → major type 1 (`-1-value`). */
export const encodeCborInt = (value: number): Uint8Array =>
    value >= 0
        ? encodeUnsigned(value, MAJOR_TYPE_UNSIGNED_INT)
        : encodeUnsigned(-1 - value, MAJOR_TYPE_NEGATIVE_INT)

/** Encodes a CBOR byte string (major type 2): length header followed by the raw bytes. */
export const encodeCborBytes = (bytes: Uint8Array): Uint8Array =>
    concatBytes(encodeUnsigned(bytes.length, MAJOR_TYPE_BYTE_STRING), bytes)

/** Encodes a CBOR UTF-8 text string (major type 3): length header (byte length) followed by the UTF-8 bytes. */
export const encodeCborText = (text: string): Uint8Array => {
    const bytes = new TextEncoder().encode(text)
    return concatBytes(
        encodeUnsigned(bytes.length, MAJOR_TYPE_TEXT_STRING),
        bytes,
    )
}

/** Encodes a CBOR definite-length map (major type 5) from already-CBOR-encoded key/value pairs, preserving pair order. */
export const encodeCborMap = (pairs: [Uint8Array, Uint8Array][]): Uint8Array =>
    concatBytes(encodeUnsigned(pairs.length, MAJOR_TYPE_MAP), ...pairs.flat())
