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

import { hmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js'
import type { Nullable } from '@perawallet/wallet-core-shared'

type SealedKvRecord = { v: 1; payload: string; tag: string }

const TAG_DOMAIN = 'pera-kv-record-v1'

// The storage key is inside the MAC so a sealed record can't be copied
// between keys; the NUL separators keep the three fields unambiguous.
const tagFor = (
    authKey: Uint8Array,
    storageKey: string,
    payload: string,
): Uint8Array =>
    hmac(
        sha256,
        authKey,
        utf8ToBytes(`${TAG_DOMAIN}\0${storageKey}\0${payload}`),
    )

const parseSealed = (raw: string): Nullable<SealedKvRecord> => {
    let parsed: unknown
    try {
        parsed = JSON.parse(raw)
    } catch {
        return null
    }
    if (typeof parsed !== 'object' || parsed === null) return null
    const record = parsed as Record<string, unknown>
    return record.v === 1 &&
        typeof record.payload === 'string' &&
        typeof record.tag === 'string'
        ? { v: 1, payload: record.payload, tag: record.tag }
        : null
}

const isConstantTimeEqual = (a: Uint8Array, b: Uint8Array): boolean => {
    if (a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
    return diff === 0
}

export const sealKvRecord = (
    authKey: Uint8Array,
    storageKey: string,
    payload: string,
): string => {
    const record: SealedKvRecord = {
        v: 1,
        payload,
        tag: bytesToHex(tagFor(authKey, storageKey, payload)),
    }
    return JSON.stringify(record)
}

export const openKvRecord = (
    authKey: Uint8Array,
    storageKey: string,
    raw: string,
): Nullable<string> => {
    const record = parseSealed(raw)
    if (record === null) return null
    let presented: Uint8Array
    try {
        presented = hexToBytes(record.tag)
    } catch {
        return null
    }
    return isConstantTimeEqual(
        presented,
        tagFor(authKey, storageKey, record.payload),
    )
        ? record.payload
        : null
}

/** Shape check only; says nothing about whether the tag verifies. */
export const isSealedKvRecord = (raw: string): boolean =>
    parseSealed(raw) !== null

/**
 * The payload of a sealed record WITHOUT verifying it. Only for a reader that
 * has no key and whose answer can't steer the wallet's reads.
 */
export const kvRecordPayload = (raw: string): Nullable<string> =>
    parseSealed(raw)?.payload ?? null
