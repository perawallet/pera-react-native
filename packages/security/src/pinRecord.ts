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

import { zeroBytes } from '@perawallet/wallet-core-kms'
import { bytesToHex } from '@perawallet/wallet-core-shared'
import { pbkdf2, randomBytes } from 'crypto'

// v1 used Argon2id in pure-JS; unusably slow on mobile engines, so it was
// replaced before any production rollout. v1 records are treated as invalid.
export const PIN_RECORD_VERSION = 2
const SALT_LENGTH_BYTES = 16
const HASH_LENGTH_BYTES = 32
// OWASP PBKDF2-SHA256 recommendation, native-backed on both Node and RN
// (via react-native-quick-crypto's metro alias on `crypto`).
const PBKDF2_ITERATIONS = 600_000
const PBKDF2_DIGEST = 'sha256'

export type PinRecord = {
    version: typeof PIN_RECORD_VERSION
    salt: string
    hash: string
    failedAttempts: number
    lockoutEndTime: number | null
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const hexToBytes = (hex: string): Uint8Array => {
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < bytes.length; i += 1) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    }
    return bytes
}

// Zeros the UTF-8 encoded PIN buffer once pbkdf2 has consumed it. The PIN
// string itself is immutable (JS strings can't be wiped) — clearing the
// encoded byte view is the best we can do without a string-zeroing
// primitive.
const hashPin = (pin: string, salt: Uint8Array): Promise<Uint8Array> =>
    new Promise((resolve, reject) => {
        const pinBytes = encoder.encode(pin)
        pbkdf2(
            pinBytes,
            salt,
            PBKDF2_ITERATIONS,
            HASH_LENGTH_BYTES,
            PBKDF2_DIGEST,
            (err, derivedKey) => {
                zeroBytes(pinBytes)
                if (err || !derivedKey) {
                    reject(err ?? new Error('pbkdf2 returned no key'))
                    return
                }
                resolve(new Uint8Array(derivedKey))
            },
        )
    })

export const createPinRecord = async (pin: string): Promise<PinRecord> => {
    const salt = new Uint8Array(randomBytes(SALT_LENGTH_BYTES))
    const hash = await hashPin(pin, salt)
    try {
        return {
            version: PIN_RECORD_VERSION,
            salt: bytesToHex(salt),
            hash: bytesToHex(hash),
            failedAttempts: 0,
            lockoutEndTime: null,
        }
    } finally {
        // Hex copies are now in the record; the raw buffers can go.
        zeroBytes(salt, hash)
    }
}

// XOR-accumulator comparison; timing is a function of length only, not content.
export const constantTimeEqual = (a: Uint8Array, b: Uint8Array): boolean => {
    if (a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i += 1) {
        diff |= a[i] ^ b[i]
    }
    return diff === 0
}

export const verifyPinAgainstRecord = async (
    pin: string,
    record: PinRecord,
): Promise<boolean> => {
    const saltBytes = hexToBytes(record.salt)
    const hashBytes = hexToBytes(record.hash)
    const candidate = await hashPin(pin, saltBytes)
    try {
        return constantTimeEqual(candidate, hashBytes)
    } finally {
        zeroBytes(candidate, saltBytes, hashBytes)
    }
}

export const serializePinRecord = (record: PinRecord): Uint8Array =>
    encoder.encode(JSON.stringify(record))

const SALT_HEX_LENGTH = SALT_LENGTH_BYTES * 2
const HASH_HEX_LENGTH = HASH_LENGTH_BYTES * 2

const isValidPinRecord = (value: unknown): value is PinRecord => {
    if (typeof value !== 'object' || value === null) return false
    const r = value as Record<string, unknown>

    if (r.version !== PIN_RECORD_VERSION) return false
    if (typeof r.salt !== 'string' || typeof r.hash !== 'string') return false

    // Validate hex shape + exact length so a corrupted/truncated record is
    // rejected rather than silently treated as a (broken) valid PIN.
    const hexOfLength = (s: string, len: number): boolean =>
        s.length === len && /^[0-9a-f]+$/i.test(s)
    if (!hexOfLength(r.salt, SALT_HEX_LENGTH)) return false
    if (!hexOfLength(r.hash, HASH_HEX_LENGTH)) return false

    // failedAttempts: finite, non-negative integer.
    if (
        typeof r.failedAttempts !== 'number' ||
        !Number.isInteger(r.failedAttempts) ||
        r.failedAttempts < 0
    ) {
        return false
    }

    // lockoutEndTime: null, or a finite, non-negative integer timestamp. A
    // NaN/Infinity/negative value would otherwise defeat the
    // `Date.now() < lockoutEndTime` lock comparison (fail open).
    if (r.lockoutEndTime !== null) {
        if (
            typeof r.lockoutEndTime !== 'number' ||
            !Number.isInteger(r.lockoutEndTime) ||
            r.lockoutEndTime < 0
        ) {
            return false
        }
    }

    return true
}

export const parsePinRecord = (data: Uint8Array): PinRecord | null => {
    try {
        const parsed: unknown = JSON.parse(decoder.decode(data))
        return isValidPinRecord(parsed) ? parsed : null
    } catch {
        return null
    }
}
