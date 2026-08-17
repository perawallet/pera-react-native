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
     * `provider` — read from the flat bare-id record the native credential
     *              providers own. It has no `k/` key to cascade-delete, so
     *              removal goes through the native module only.
     */
    source: 'keystore' | 'native' | 'provider'
    /**
     * The credential was derived from the XHD root before the
     * deterministic-P256 split, so it still signs in but cannot be reproduced
     * from the recovery phrase. Set from the `metadata.migration` marker
     * upstream's `migrateLegacyPasskeys` stamps; always `false` for a native
     * identity-store row, whose shape carries no metadata bag.
     */
    needsMigration: boolean
}

/**
 * `PASSKEY_MIGRATION_NEEDED` from `@algorandfoundation/react-native-keystore`,
 * restated rather than imported — the same trade-off `bootstrapPasskeyAutofill.ts`
 * makes for `PASSKEY_MAIN_KEY_SCHEME`. This module is re-exported by the
 * `./webauthn` entry, which exists precisely so a browser-extension consumer
 * is not forced to resolve the keystore's `react-native-mmkv` graph; importing
 * the constant here would put that graph back. Drift is pinned in
 * `__tests__/passkey.spec.ts` against the real export.
 */
export const PASSKEY_MIGRATION_NEEDED = 'needs-migration'

/**
 * Reads the marker `migrateLegacyPasskeys` writes (see the keystore package's
 * `src/storage/driver.ts`). The marker rides on the credential's `metadata`
 * bag, so this reads identically off a `k/` record and off the flat provider
 * record `repairs/0002-rematerialize-passkey-credentials` rewrites.
 */
export const isMigrationFlagged = (
    metadata: Record<string, unknown> | undefined,
): boolean => metadata?.migration === PASSKEY_MIGRATION_NEEDED

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
        needsMigration: isMigrationFlagged(meta),
    }
}

/**
 * Projects a decoded flat bare-id provider record. The record is a keystore
 * `Key` plus `privateKey`, with the byte fields as JSON number arrays — none
 * of which {@link keyToPasskey} reads — so the projection is shared and only
 * the attribution differs.
 */
export const flatRecordToPasskey = (record: unknown): Passkey | null => {
    if (typeof record !== 'object' || record === null) return null

    const projected = keyToPasskey(record as Key)
    if (!projected) return null

    return { ...projected, source: 'provider' }
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
        // `PasskeyAutofillCredentialIdentity` has no metadata bag, so the
        // marker cannot be read here; the flat-record source supplies it.
        needsMigration: false,
    }
}

/** Some native implementations emit `createdAt` in seconds, others in ms. */
const normalizeTimestamp = (value: number | undefined): number | undefined => {
    if (typeof value !== 'number') return undefined
    return value < 10_000_000_000 ? value * 1000 : value
}
