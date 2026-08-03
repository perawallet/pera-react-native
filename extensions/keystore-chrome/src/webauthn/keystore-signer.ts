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

import {
    InvalidKeyDataError,
    KeyNotFoundError,
    sign as signKeyData,
    type Key,
    type KeyData,
    type KeyStoreState,
} from '@algorandfoundation/keystore'
import { sha256 } from '@noble/hashes/sha2'
import type { Store } from '@tanstack/store'
import {
    bytesToB64url,
    deriveCredentialId,
    isPasskeyKey,
    splitP256PublicKey,
    type KeystoreSigner,
} from '@perawallet/wallet-core-passkeys/webauthn'
import { fetchSecret } from '../storage/state'
import { generateKey } from '../store'

/**
 * Implements the `KeystoreSigner` port over keystore-chrome's real
 * `key.store` surface. Every WebAuthn P-256 passkey this adapter creates is
 * an `hd-derived-p256` keystore entry, derived (via `@algorandfoundation/dp256`
 * inside the keystore lib) from a single persisted `hd-root-key` that in turn
 * derives from the wallet's `seed`/`hd-seed` entry — mirroring the
 * `seed -> hd-root-key -> hd-derived-*` chain `store.ts` already uses for
 * Ed25519 account keys.
 *
 * FINDING — why a persisted `hd-root-key` is required (not just the seed's
 * id): `store.ts`'s `generateKey` P256 branch (~176-231) accepts a
 * `params.parentKeyId` that may name either an existing `hd-root-key` or a
 * `seed`. When it's a `seed`, that branch derives a *fresh, never-committed*
 * `hd-root-key` in memory, uses it once, then zeroes it
 * (`clearKeyData(rootKey)`) — the derived `hd-derived-p256` key's
 * `metadata.parentKeyId` ends up pointing at an id that was never written to
 * storage. `signP256` (below, mirroring `extension.ts`'s `sign` handler)
 * fetches the parent by that id via `fetchSecret` — which would return
 * `null` and throw `KeyNotFoundError` on every subsequent sign. Passing an
 * *already-persisted* `hd-root-key`'s id sidesteps this: `generateKey` takes
 * the `isXHDRootKey(parentKey)` branch instead, reusing that same
 * (storage-backed) id as `parentKeyId`, so `signP256` can always resolve it.
 * `resolveRootKeyId` below lazily creates and persists exactly one such root
 * key (tagged with `ROOT_KEY_PURPOSE` in its metadata so it's identifiable
 * and reused, never regenerated, across every credential this adapter mints).
 */

/** Tags the lazily-created, persisted `hd-root-key` this adapter derives every P-256 passkey from. */
const ROOT_KEY_PURPOSE = 'webauthn-passkeys'

const readMetadataString = (key: Key, field: string): string | undefined => {
    const value = (key.metadata as Record<string, unknown> | undefined)?.[field]
    return typeof value === 'string' ? value : undefined
}

/**
 * Normalizes whatever `key.publicKey` the keystore hands back (64-byte raw
 * `X || Y`, or 65-byte `0x04`-prefixed) into the flat 64-byte `X || Y` form
 * the `KeystoreSigner` port's `publicKeyXY` fields use.
 */
const toFlatXY = (publicKey: Uint8Array): Uint8Array => {
    const { x, y } = splitP256PublicKey(publicKey)
    const flat = new Uint8Array(x.length + y.length)
    flat.set(x, 0)
    flat.set(y, x.length)
    return flat
}

/**
 * Finds this adapter's persisted `hd-root-key` (identified by
 * `metadata.purpose === ROOT_KEY_PURPOSE`), or derives and commits one from
 * the wallet's `seed`/`hd-seed` entry if it doesn't exist yet. See the
 * module doc above for why this must be a persisted root key, not the bare
 * seed id.
 */
const resolveRootKeyId = async (
    store: Store<KeyStoreState>,
): Promise<string> => {
    const existingRootKey = store.state.keys.find(
        key =>
            key.type === 'hd-root-key' &&
            readMetadataString(key, 'purpose') === ROOT_KEY_PURPOSE,
    )
    if (existingRootKey) return existingRootKey.id

    const seed = store.state.keys.find(
        key => key.type === 'seed' || key.type === 'hd-seed',
    )
    if (!seed) {
        throw new InvalidKeyDataError(
            'No wallet seed found in the keystore; cannot derive a WebAuthn P-256 credential.',
        )
    }

    return generateKey({
        store,
        type: 'hd-root-key',
        algorithm: 'raw',
        extractable: false,
        keyUsages: ['deriveKey', 'deriveBits'],
        params: { parentKeyId: seed.id, purpose: ROOT_KEY_PURPOSE },
    })
}

/**
 * Builds a {@link KeystoreSigner} over a live keystore-chrome `Store`. Pass
 * the same `Store<KeyStoreState>` instance the extension's background
 * context uses (see `getKeystoreStore()` in `extensions/provider`) so every
 * credential this mints and signs is visible to the rest of the extension.
 */
export const createKeystoreSigner = (
    store: Store<KeyStoreState>,
): KeystoreSigner => ({
    async createP256Credential({
        rpId,
        userHandle,
        userHandleOriginalB64Url,
        displayName,
        userName,
    }) {
        const rootKeyId = await resolveRootKeyId(store)

        // Redundant today (the core already lowercases), but load-bearing if
        // that changes: the keystore lib lowercases `metadata.userHandle` on
        // its GENERATION path but not its SIGN path, so non-lowercase stored
        // metadata would re-derive a different keypair than the public key we
        // returned at registration.
        const normalizedUserHandle = userHandle.toLowerCase()

        const keyId = await generateKey({
            store,
            type: 'hd-derived-p256',
            algorithm: 'P256',
            extractable: true,
            keyUsages: ['sign'],
            params: {
                parentKeyId: rootKeyId,
                origin: rpId,
                userHandle: normalizedUserHandle,
                // Byte-exact base64url of the RP's original `user.id` bytes —
                // separate from `userHandle` (the lossy derivation input)
                // above. NEVER fed into key derivation; only used by
                // `listP256Credentials` to answer with the real `user.id` on
                // assertion. See the module doc's userHandle-encoding finding.
                userHandleOriginal: userHandleOriginalB64Url,
                counter: 0,
                displayName,
                userName,
                createdAt: Date.now(),
            },
        })

        const key = store.state.keys.find(k => k.id === keyId)
        if (!key?.publicKey) {
            throw new InvalidKeyDataError(
                `Generated P-256 credential ${keyId} is missing its public key.`,
            )
        }

        return { keyId, publicKeyXY: toFlatXY(key.publicKey) }
    },

    async signP256(keyId, data) {
        const key = await fetchSecret<KeyData>({ keyId })
        if (!key) throw new KeyNotFoundError(keyId)

        const parentKeyId = readMetadataString(key, 'parentKeyId')
        if (!parentKeyId) {
            throw new InvalidKeyDataError(
                `P-256 key ${keyId} is missing its parent key ID.`,
            )
        }
        const parentKey = await fetchSecret<KeyData>({ keyId: parentKeyId })
        if (!parentKey) throw new KeyNotFoundError(parentKeyId)

        // The adapter must hash, because the two sides disagree on what
        // "sign" means. The keystore's P-256 path is a RAW ECDSA primitive —
        // noble's `p256.sign` defaults to `prehash: false`, so it signs the
        // caller's bytes as an already-computed digest. WebAuthn ES256 requires
        // the signature to be over `SHA256(authenticatorData || clientDataHash)`.
        // Without hashing here, every assertion would fail verification against
        // a standards-compliant relying party.
        const digest = sha256(data)

        // Raw 64-byte (r ‖ s) — the port's core DER-encodes, this adapter must not.
        return signKeyData({
            store,
            key,
            parentKey: { ...parentKey, type: 'hd-root-key', format: 'raw' },
            data: digest,
        })
    },

    async listP256Credentials(rpId) {
        return store.state.keys
            .filter(isPasskeyKey)
            .filter(key => readMetadataString(key, 'origin') === rpId)
            .flatMap(key => {
                const derivationUserHandle = readMetadataString(
                    key,
                    'userHandle',
                )
                if (!derivationUserHandle || !key.publicKey) return []

                // Prefer the byte-exact original `user.id` this adapter
                // started persisting alongside the derivation `userHandle`
                // (see `createP256Credential`). Fall back to base64url of
                // the (lowercased, lossy) derivation string only for a key
                // minted before this field existed — that fallback is NOT
                // byte-identical to the RP's original `user.id` for mixed-case
                // or non-UTF-8 handles, but keeps a pre-existing credential
                // listable rather than dropping it outright.
                const userHandle =
                    readMetadataString(key, 'userHandleOriginal') ??
                    bytesToB64url(
                        new TextEncoder().encode(derivationUserHandle),
                    )

                const publicKeyXY = toFlatXY(key.publicKey)
                return [
                    {
                        keyId: key.id,
                        credentialId: deriveCredentialId(publicKeyXY),
                        publicKeyXY,
                        userHandle,
                    },
                ]
            })
    },
})
