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

import type { Key } from '@algorandfoundation/keystore-core'
import {
    decodeFromBase64,
    encodeToBase64,
    logger,
} from '@perawallet/wallet-core-shared'
import {
    derivePasskeyCredential,
    derivePasskeyMainKey,
} from '../crypto/derivePasskeyCredential'
import { isMigrationFlagged } from './passkey'

/** Suffix `passkeyMainKeyId` appends to a seed key id. Restated rather than
 *  imported so this module stays out of the provider's dependency graph. */
const PASSKEY_MAIN_KEY_SUFFIX = '-passkey-main'

export const seedKeyIdFromPasskeyMainKeyId = (
    mainKeyId: string,
): string | null =>
    mainKeyId.endsWith(PASSKEY_MAIN_KEY_SUFFIX)
        ? mainKeyId.slice(0, -PASSKEY_MAIN_KEY_SUFFIX.length)
        : null

export type PasskeyBackupInputs = {
    credentialId: string
    origin: string
    /** The exact string that reproduced this credential. Replayed, never rebuilt. */
    identity: string
    counter: number
    /** Base64 of the 91-byte SPKI DER. */
    publicKeySpkiDer: string
    seedKeyId: string
    userId?: string
    userName?: string
    displayName?: string
    createdAt: number
}

const readString = (
    metadata: Record<string, unknown>,
    field: string,
): string | undefined =>
    typeof metadata[field] === 'string'
        ? (metadata[field] as string)
        : undefined

/**
 * `userHandle`/`userId` travel as base64-encoded bytes, and iOS derives from
 * their decoded utf8 text rather than the base64 form (mirrors
 * `ASPasskeyCredentialIdentity.userHandleString`). A value that is not valid
 * base64, or whose bytes are not valid utf8, simply yields no decoded
 * candidate — the raw form is still tried on its own.
 */
const decodedBase64Candidate = (value: string): string | undefined => {
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(
            decodeFromBase64(value),
        )
    } catch {
        return undefined
    }
}

/**
 * Every identity string a known writer could have fed into derivation. iOS uses
 * the utf8 user handle, Android the user name, the extension the canonical user
 * id — all lowercased. Which one applies is not recorded anywhere reliable, so
 * the public-key comparison arbitrates instead of a stored version tag.
 */
export const identityCandidates = (
    metadata: Record<string, unknown>,
): string[] => {
    const userHandle = readString(metadata, 'userHandle')
    const userId = readString(metadata, 'userId')

    const raw = [
        userHandle,
        userHandle != null ? decodedBase64Candidate(userHandle) : undefined,
        readString(metadata, 'userName'),
        userId,
        userId != null ? decodedBase64Candidate(userId) : undefined,
    ]
    const seen = new Set<string>()
    for (const value of raw) {
        if (value == null || value.length === 0) continue
        seen.add(value.toLowerCase())
    }
    return [...seen]
}

const PASSKEY_KEY_TYPE = 'hd-derived-p256'

/**
 * A credential's backup inputs, or `null` when this device cannot reproduce it.
 * Reproducibility is proven here rather than inferred: the derived public key
 * must equal the one the record already holds, which is also what lets restore
 * treat a later mismatch as corruption instead of a wrong guess.
 */
export const passkeyBackupInputs = async (
    key: Key,
    resolveSeedEntropy: (seedKeyId: string) => Promise<Uint8Array | null>,
    subtle?: SubtleCrypto,
): Promise<PasskeyBackupInputs | null> => {
    if (key.type !== PASSKEY_KEY_TYPE) return null

    const metadata = (key.metadata ?? {}) as Record<string, unknown>
    if (isMigrationFlagged(metadata)) return null

    const origin = readString(metadata, 'origin')
    const parentKeyId = readString(metadata, 'parentKeyId')
    const storedPublicKey = key.publicKey
    if (!origin || !parentKeyId || !storedPublicKey) return null

    const seedKeyId = seedKeyIdFromPasskeyMainKeyId(parentKeyId)
    if (seedKeyId === null) return null

    const entropy = await resolveSeedEntropy(seedKeyId)
    if (entropy === null) return null

    const counter =
        typeof metadata.count === 'number' ? (metadata.count as number) : 0
    const mainKey = await derivePasskeyMainKey(entropy, subtle)
    const expected = encodeToBase64(storedPublicKey)

    for (const identity of identityCandidates(metadata)) {
        const derived = await derivePasskeyCredential({
            mainKey,
            origin,
            identity,
            counter,
        })
        if (encodeToBase64(derived.publicKeySpkiDer) !== expected) continue

        return {
            credentialId: key.id,
            origin,
            identity,
            counter,
            publicKeySpkiDer: expected,
            seedKeyId,
            userId: readString(metadata, 'userId'),
            userName: readString(metadata, 'userName'),
            displayName: readString(metadata, 'displayName'),
            createdAt:
                typeof metadata.createdAt === 'number'
                    ? (metadata.createdAt as number)
                    : Date.now(),
        }
    }

    // Not an error: a credential from a writer whose identity rule is not in the
    // candidate list is excluded rather than mis-derived. Logged with the origin
    // so a systematic gap is diagnosable.
    logger.warn('passkeyBackupInputs: no candidate reproduced the credential', {
        origin,
    })
    return null
}
