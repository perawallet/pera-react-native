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

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto'
import {
    concatBytes,
    decodeFromBase64,
    encodeToBase64,
} from '@perawallet/wallet-core-shared'
import { zeroBytes } from './secure-memory'

const AES_GCM_ALGORITHM = 'aes-256-gcm'
const AES_GCM_IV_LENGTH = 12
const AES_GCM_TAG_LENGTH = 16

/**
 * `reason` is the discriminant callers branch on. Matching on the message
 * instead would break silently the first time it is reworded.
 */
export class AesGcmOpenError extends Error {
    constructor(readonly reason: 'too-short' | 'open-failed' = 'open-failed') {
        super(`Failed to open AES-GCM payload: ${reason}`)
        this.name = 'AesGcmOpenError'
    }
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/**
 * Seals UTF-8 plaintext as base64( IV(12) || CIPHERTEXT || TAG(16) ) under
 * AES-256-GCM. `key` is caller-owned and deliberately not zeroed here.
 *
 * The concatenated layout is this function's own contract. Records written by
 * the native passkey provider and by the web vault carry a detached tag in a
 * JSON envelope instead, so they are not interchangeable with these payloads.
 */
export const sealAesGcm = (
    plaintext: string,
    key: Uint8Array,
    aad: Uint8Array,
): string => {
    let plaintextBytes: Uint8Array | null = null
    try {
        const iv = new Uint8Array(randomBytes(AES_GCM_IV_LENGTH))
        const cipher = createCipheriv(AES_GCM_ALGORITHM, key, iv)
        cipher.setAAD(aad)
        plaintextBytes = encoder.encode(plaintext)
        const ciphertext = concatBytes(
            new Uint8Array(cipher.update(plaintextBytes)),
            new Uint8Array(cipher.final()),
        )
        const tag = new Uint8Array(cipher.getAuthTag())
        return encodeToBase64(concatBytes(iv, ciphertext, tag))
    } finally {
        zeroBytes(plaintextBytes)
    }
}

/**
 * Throws `AesGcmOpenError` on a wrong key, wrong AAD, or tampered bytes.
 * `key` is caller-owned and deliberately not zeroed here.
 */
export const openAesGcm = (
    payloadBase64: string,
    key: Uint8Array,
    aad: Uint8Array,
): string => {
    let updateBytes: Uint8Array | null = null
    let finalBytes: Uint8Array | null = null
    let plaintext: Uint8Array | null = null
    try {
        const raw = decodeFromBase64(payloadBase64)
        if (raw.length < AES_GCM_IV_LENGTH + AES_GCM_TAG_LENGTH) {
            throw new AesGcmOpenError('too-short')
        }
        const iv = raw.subarray(0, AES_GCM_IV_LENGTH)
        const tag = raw.subarray(raw.length - AES_GCM_TAG_LENGTH)
        const ciphertext = raw.subarray(
            AES_GCM_IV_LENGTH,
            raw.length - AES_GCM_TAG_LENGTH,
        )
        const decipher = createDecipheriv(AES_GCM_ALGORITHM, key, iv)
        decipher.setAAD(aad)
        decipher.setAuthTag(tag)
        updateBytes = decipher.update(ciphertext)
        finalBytes = decipher.final()
        plaintext = concatBytes(updateBytes, finalBytes)
        return decoder.decode(plaintext)
    } catch (error) {
        if (error instanceof AesGcmOpenError) throw error
        throw new AesGcmOpenError()
    } finally {
        zeroBytes(updateBytes, finalBytes, plaintext)
    }
}
