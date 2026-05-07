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

const bytesToHex = (bytes: Uint8Array): string => {
    let out = ''
    for (let i = 0; i < bytes.length; i += 1) {
        out += bytes[i].toString(16).padStart(2, '0')
    }
    return out
}

const hexToBytes = (hex: string): Uint8Array => {
    const bytes = new Uint8Array(hex.length / 2)
    for (let i = 0; i < bytes.length; i += 1) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    }
    return bytes
}

const hashPin = (pin: string, salt: Uint8Array): Promise<Uint8Array> =>
    new Promise((resolve, reject) => {
        pbkdf2(
            encoder.encode(pin),
            salt,
            PBKDF2_ITERATIONS,
            HASH_LENGTH_BYTES,
            PBKDF2_DIGEST,
            (err, derivedKey) => {
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
    return {
        version: PIN_RECORD_VERSION,
        salt: bytesToHex(salt),
        hash: bytesToHex(hash),
        failedAttempts: 0,
        lockoutEndTime: null,
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
    const candidate = await hashPin(pin, hexToBytes(record.salt))
    return constantTimeEqual(candidate, hexToBytes(record.hash))
}

export const serializePinRecord = (record: PinRecord): Uint8Array =>
    encoder.encode(JSON.stringify(record))

const isValidPinRecord = (value: unknown): value is PinRecord => {
    if (typeof value !== 'object' || value === null) return false
    const r = value as Record<string, unknown>
    return (
        r.version === PIN_RECORD_VERSION &&
        typeof r.salt === 'string' &&
        typeof r.hash === 'string' &&
        typeof r.failedAttempts === 'number' &&
        (r.lockoutEndTime === null || typeof r.lockoutEndTime === 'number')
    )
}

export const parsePinRecord = (data: Uint8Array): PinRecord | null => {
    try {
        const parsed: unknown = JSON.parse(decoder.decode(data))
        return isValidPinRecord(parsed) ? parsed : null
    } catch {
        return null
    }
}
