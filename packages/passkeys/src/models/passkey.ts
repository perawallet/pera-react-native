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

import type { Key } from '@algorandfoundation/keystore'
import { toUrlSafeBase64 } from '@perawallet/wallet-core-shared'
import type { NativeStoredCredential } from '@perawallet/wallet-extension-passkey-autofill'

/**
 * A passkey credential exposed to the UI. This is a projection over the
 * keystore (for keystore-backed credentials) merged with credentials known to
 * the native autofill identity store (for orphans that have not yet been
 * reconciled into the keystore).
 *
 * Private key material is never represented here — passkeys are derived
 * deterministically from the HD root key by the native Credential Provider
 * extension on every assertion.
 */
export interface Passkey {
    /** url-safe base64 of the raw keystore key.id; this is the WebAuthn credentialId */
    id: string
    /** raw keystore key.id (used for cascade delete from the keystore) */
    keyId: string
    /**
     * Human-readable display name, supplied by the relying party at
     * registration time. Falls back to the origin when the RP did not
     * supply one.
     */
    displayName: string
    /** WebAuthn relying-party ID, e.g. "example.com" */
    origin: string
    /** WebAuthn user handle, base64url */
    userHandle: string
    /** Human-readable username if known. Sourced from the native credential metadata. */
    userName?: string
    algorithm: 'P256'
    /** ms since epoch */
    createdAt: number
    /** ms since epoch; populated from native lastUsedAt when available */
    lastUsedAt?: number
    /**
     * `keystore` — passkey reconciled with a keystore key.
     * `native`   — credential exists in the native autofill store but no
     *              matching keystore key was found this bootstrap; will
     *              reconcile on next hydration.
     */
    source: 'keystore' | 'native'
}

/**
 * Keystore key types that correspond to a P256 passkey credential.
 *
 * `xhd-derived-p256` is accepted as a forward-compat alias used by upstream
 * keystore branches.
 */
export const PASSKEY_KEY_TYPES = new Set<string>([
    'hd-derived-p256',
    'xhd-derived-p256',
])

export const isPasskeyKey = (key: Key): boolean =>
    PASSKEY_KEY_TYPES.has(key.type)

export const isPasskeyAlgorithm = (algorithm: string | undefined): boolean =>
    algorithm === 'P256'

const readString = (
    m: Record<string, unknown>,
    k: string,
): string | undefined =>
    typeof m[k] === 'string' ? (m[k] as string) : undefined

const readNumber = (
    m: Record<string, unknown>,
    k: string,
): number | undefined =>
    typeof m[k] === 'number' ? (m[k] as number) : undefined

/**
 * Resolves the human-readable account name shown as the card title.
 *
 * iOS populates `userName`; the Android credential provider only sets
 * `userHandle` (with the WebAuthn `user.name`, e.g. "alice@example.com") and
 * leaves `userName`/`displayName` empty. Falling through every candidate the
 * same way for both sources keeps the title identical across platforms instead
 * of degrading to the bare origin on Android.
 */
const resolveAccountName = (candidates: {
    displayName?: string
    name?: string
    userName?: string
    userHandle: string
}): string =>
    candidates.displayName ??
    candidates.name ??
    candidates.userName ??
    candidates.userHandle

/**
 * Projects a keystore P256-derived key into a Passkey row. Returns `null` when
 * the key is missing required passkey metadata (origin + userHandle).
 */
export const keyToPasskey = (key: Key): Passkey | null => {
    if (!isPasskeyKey(key)) return null

    const meta = (key.metadata ?? {}) as Record<string, unknown>
    const origin = readString(meta, 'origin')
    const userHandle = readString(meta, 'userHandle')
    if (!origin || !userHandle) return null

    return {
        id: toUrlSafeBase64(key.id),
        keyId: key.id,
        displayName: resolveAccountName({
            displayName: readString(meta, 'displayName'),
            name: readString(meta, 'name'),
            userName: readString(meta, 'userName'),
            userHandle,
        }),
        origin,
        userHandle,
        userName: readString(meta, 'userName'),
        algorithm: 'P256',
        createdAt: readNumber(meta, 'createdAt') ?? Date.now(),
        lastUsedAt: readNumber(meta, 'lastUsedAt'),
        source: 'keystore',
    }
}

/**
 * Projects a native autofill credential entry into a Passkey row. The native
 * side uses a few different field names depending on platform and version, so
 * this normalizes them.
 */
export const credentialToPasskey = (
    credential: NativeStoredCredential,
): Passkey | null => {
    const origin =
        credential.rpId ??
        credential.relyingPartyIdentifier ??
        credential.origin
    if (!origin || !credential.credentialId || !credential.userHandle)
        return null

    const createdAt = normalizeTimestamp(credential.createdAt)

    return {
        id: toUrlSafeBase64(credential.credentialId),
        keyId: credential.credentialId,
        displayName: resolveAccountName({
            name: credential.name,
            userName: credential.userName,
            userHandle: credential.userHandle,
        }),
        origin,
        userHandle: credential.userHandle,
        userName: credential.userName,
        algorithm: 'P256',
        createdAt: createdAt ?? Date.now(),
        source: 'native',
    }
}

/** Some native implementations emit `createdAt` in seconds, others in ms. */
const normalizeTimestamp = (value: number | undefined): number | undefined => {
    if (typeof value !== 'number') return undefined
    return value < 10_000_000_000 ? value * 1000 : value
}
