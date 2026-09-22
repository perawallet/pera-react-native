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
import { zeroBytes } from '@perawallet/wallet-core-kms'
import {
    bytesEqual,
    concatBytes,
    decodeFromBase64,
    encodeToBase64,
    logger,
} from '@perawallet/wallet-core-shared'
import { toDerivationUserHandle } from '../authenticator/authenticator'
import { splitP256PublicKey } from '../authenticator/webauthn-structures'
import {
    derivePasskeyCredential,
    derivePasskeyMainKey,
    p256RawPublicKeyToSpkiDer,
} from '../crypto/derivePasskeyCredential'
import { isMigrationFlagged, normalizeTimestamp } from './passkey'

/** Suffix `passkeyMainKeyId` appends to a seed key id. Restated rather than
 *  imported so this module stays out of the provider's dependency graph. */
const PASSKEY_MAIN_KEY_SUFFIX = '-passkey-main'

export const seedKeyIdFromPasskeyMainKeyId = (
    mainKeyId: string,
): string | null => {
    if (!mainKeyId.endsWith(PASSKEY_MAIN_KEY_SUFFIX)) return null
    const seedKeyId = mainKeyId.slice(0, -PASSKEY_MAIN_KEY_SUFFIX.length)
    return seedKeyId.length > 0 ? seedKeyId : null
}

export type PasskeyBackupInputs = {
    credentialId: string
    origin: string
    /** The exact string that reproduced this credential. Replayed, never rebuilt. */
    identity: string
    /** The derivation counter (`metadata.counter`), NOT the WebAuthn signature counter. */
    counter: number
    /** Base64 of the derived 91-byte SPKI DER — never an echo of whatever the record stored. */
    publicKeySpkiDer: string
    seedKeyId: string
    userId?: string
    userName?: string
    displayName?: string
    /** Unix ms. */
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
 * `userHandle`/`userId` travel as base64-encoded bytes. Decoding and running
 * them through `toDerivationUserHandle` reproduces exactly what iOS/the
 * extension fed into derivation (utf8 text, or its base64url form when the
 * bytes aren't valid utf8). A value that isn't valid base64 yields no decoded
 * candidate — the raw form is still tried on its own.
 */
const decodedBase64Candidate = (value: string): string | undefined => {
    try {
        return toDerivationUserHandle(decodeFromBase64(value))
    } catch {
        return undefined
    }
}

/**
 * Every identity string a known writer could have derived from. iOS derives
 * from the user-handle bytes via `toDerivationUserHandle` (utf8, else
 * base64url) lowercased, but stores the bytes standard-base64 under both
 * `userHandle` and `userId` (`PasskeyCredentialStore.swift`'s
 * `saveKeystoreCredential`) — not the derivation input. The engine
 * (`keystore-signer.ts`) stores the already-lowercased derivation identity
 * verbatim under `userHandle` instead. So each field is tried both raw and
 * decoded; no stored field says which writer wrote it, and the public-key
 * comparison arbitrates instead of a version tag.
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
const SPKI_DER_LENGTH = 91

/**
 * Writers disagree on the stored public-key encoding: `keystore-core`'s own
 * domain-key derivation (the extension's path, via `deriveDomainKey`) stores
 * the raw 64-byte point (`getPurePKBytes`, no `0x04` prefix), while iOS and
 * Android store 91-byte SPKI DER. Normalise to SPKI DER — the form
 * `derivePasskeyCredential` produces — before comparing. Throws on an input
 * that is neither shape; callers catch.
 */
const toSpkiDer = (publicKey: Uint8Array): Uint8Array => {
    if (publicKey.length === SPKI_DER_LENGTH) return publicKey
    const { x, y } = splitP256PublicKey(publicKey)
    return p256RawPublicKeyToSpkiDer(concatBytes(x, y))
}

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
    // A credential the legacy importer wrote (`writeNativePasskeyEntry`
    // without a `parentKeyId`) is excluded here rather than by name: it's
    // derived from a mnemonic string, not seed entropy, and feeds `userName`
    // verbatim without lowercasing, so it could never be reproduced by this
    // function even if it did carry a parent key id.
    if (!origin || !parentKeyId || !storedPublicKey) return null

    const seedKeyId = seedKeyIdFromPasskeyMainKeyId(parentKeyId)
    if (seedKeyId === null) return null

    let storedSpkiDer: Uint8Array
    try {
        storedSpkiDer = toSpkiDer(storedPublicKey)
    } catch {
        // Neither 64/65 nor 91 bytes: a writer this module doesn't know
        // about. Unlike "no candidate matched", this path leaves no other
        // evidence, so it's logged even though it's not thrown.
        logger.warn(
            'passkeyBackupInputs: stored public key is not a recognised length',
            { origin, storedPublicKeyLength: storedPublicKey.length },
        )
        return null
    }

    // `entropy` is owned by `resolveSeedEntropy`'s caller, not by this
    // function — it's zeroed (or not) at that buffer's own lifetime, e.g.
    // `withSecret`'s `finally`. Only `mainKey` and each `derived.privateKey`,
    // which this function allocates, are this function's to zero.
    const entropy = await resolveSeedEntropy(seedKeyId)
    if (entropy == null) return null

    // The derivation counter `keystore-core` writes, NOT the WebAuthn
    // signature counter (`metadata.count`, which iOS/Android bump on every
    // assertion and never feed into derivation).
    const counter =
        typeof metadata.counter === 'number' ? (metadata.counter as number) : 0

    const mainKey = await derivePasskeyMainKey(entropy, subtle)
    try {
        for (const identity of identityCandidates(metadata)) {
            const derived = await derivePasskeyCredential({
                mainKey,
                origin,
                identity,
                counter,
            })
            try {
                if (!bytesEqual(derived.publicKeySpkiDer, storedSpkiDer))
                    continue

                return {
                    credentialId: key.id,
                    origin,
                    identity,
                    counter,
                    publicKeySpkiDer: encodeToBase64(derived.publicKeySpkiDer),
                    seedKeyId,
                    userId: readString(metadata, 'userId'),
                    userName: readString(metadata, 'userName'),
                    displayName: readString(metadata, 'displayName'),
                    createdAt:
                        normalizeTimestamp(
                            typeof metadata.createdAt === 'number'
                                ? (metadata.createdAt as number)
                                : undefined,
                        ) ?? Date.now(),
                }
            } finally {
                zeroBytes(derived.privateKey)
            }
        }

        // Not an error: a credential from a writer whose identity rule is not
        // in the candidate list is excluded rather than mis-derived. Logged
        // with the origin so a systematic gap is diagnosable.
        logger.warn(
            'passkeyBackupInputs: no candidate reproduced the credential',
            { origin },
        )
        return null
    } finally {
        zeroBytes(mainKey)
    }
}
