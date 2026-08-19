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

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto'
import { zeroBytes } from '@perawallet/wallet-core-kms'
import {
    concatBytes,
    decodeFromBase64,
    encodeToBase64,
} from '@perawallet/wallet-core-shared'
import type { BackupId, BackupItemKey } from '../models'
import { BACKUP_CIPHER_ALGORITHM } from './constants'

const IV_LENGTH = 12
const TAG_LENGTH = 16

export class DecryptItemPayloadError extends Error {
    constructor(message = 'Failed to decrypt backup item payload') {
        super(message)
        this.name = 'DecryptItemPayloadError'
    }
}

type PayloadContext = {
    encryptionKey: Uint8Array
    backupId: BackupId
    key: BackupItemKey
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const aadFor = ({ backupId, key }: PayloadContext): Uint8Array =>
    encoder.encode(`${backupId}|${key}`)

/**
 * Encrypts UTF-8 plaintext into the canonical backup payload:
 * base64( IV(12) || CIPHERTEXT || TAG(16) ), AES-256-GCM, AAD = `backupId|key`.
 * Defines the format the push flow must reuse.
 *
 * `ctx.encryptionKey` is caller-owned and reused across every item in a sync,
 * so it is deliberately not zeroed here.
 */
export const encryptItemPayload = (
    plaintext: string,
    ctx: PayloadContext,
): string => {
    let plaintextBytes: Uint8Array | null = null
    try {
        const iv = new Uint8Array(randomBytes(IV_LENGTH))
        const cipher = createCipheriv(
            BACKUP_CIPHER_ALGORITHM,
            ctx.encryptionKey,
            iv,
        )
        cipher.setAAD(aadFor(ctx))
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
 * Decrypts a canonical backup payload back to its UTF-8 plaintext.
 *
 * `ctx.encryptionKey` is caller-owned and reused across every item in a
 * restore, so it is deliberately not zeroed here.
 */
export const decryptItemPayload = (
    payloadBase64: string,
    ctx: PayloadContext,
): string => {
    let updateBytes: Uint8Array | null = null
    let finalBytes: Uint8Array | null = null
    let plaintext: Uint8Array | null = null
    try {
        const raw = decodeFromBase64(payloadBase64)
        if (raw.length < IV_LENGTH + TAG_LENGTH) {
            throw new DecryptItemPayloadError('Payload too short')
        }
        const iv = raw.subarray(0, IV_LENGTH)
        const tag = raw.subarray(raw.length - TAG_LENGTH)
        const ciphertext = raw.subarray(IV_LENGTH, raw.length - TAG_LENGTH)
        const decipher = createDecipheriv(
            BACKUP_CIPHER_ALGORITHM,
            ctx.encryptionKey,
            iv,
        )
        decipher.setAAD(aadFor(ctx))
        decipher.setAuthTag(tag)
        updateBytes = decipher.update(ciphertext)
        finalBytes = decipher.final()
        plaintext = concatBytes(updateBytes, finalBytes)
        return decoder.decode(plaintext)
    } catch (error) {
        if (error instanceof DecryptItemPayloadError) throw error
        throw new DecryptItemPayloadError()
    } finally {
        zeroBytes(updateBytes, finalBytes, plaintext)
    }
}
