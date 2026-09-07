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

import type { BackupId, BackupItemKey } from '../models'
import { AesGcmOpenError, openAesGcm, sealAesGcm } from './aesGcm'

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

const aadFor = ({ backupId, key }: PayloadContext): Uint8Array =>
    encoder.encode(`${backupId}|${key}`)

/**
 * Encrypts UTF-8 plaintext into the canonical backup payload:
 * base64( IV(12) || CIPHERTEXT || TAG(16) ), AES-256-GCM, AAD = `backupId|key`.
 *
 * `ctx.encryptionKey` is caller-owned and reused across every item in a sync,
 * so it is deliberately not zeroed here.
 */
export const encryptItemPayload = (
    plaintext: string,
    ctx: PayloadContext,
): string => sealAesGcm(plaintext, ctx.encryptionKey, aadFor(ctx))

/** Decrypts a canonical backup payload back to its UTF-8 plaintext. */
export const decryptItemPayload = (
    payloadBase64: string,
    ctx: PayloadContext,
): string => {
    try {
        return openAesGcm(payloadBase64, ctx.encryptionKey, aadFor(ctx))
    } catch (error) {
        throw new DecryptItemPayloadError(
            error instanceof AesGcmOpenError && error.reason === 'too-short'
                ? 'Payload too short'
                : undefined,
        )
    }
}
