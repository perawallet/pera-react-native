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

import type { Key } from '@algorandfoundation/keystore'
import {
    getKeystoreStore,
    getProvider,
} from '@perawallet/wallet-extension-provider'
import { toBase64Url } from './webauthn'
import type { CredentialMechanism } from './bootstrap'
import {
    createKeystoreCredentialMechanismCore,
    type KeystoreCredentialMechanism,
    type P256KeyAccess,
    type P256PublicKeyXY,
} from './keystoreCredentials'

// Seed entries the HD P256 derivation can root from.
const SEED_KEY_TYPES = new Set<string>(['seed', 'hd-seed'])
const P256_KEY_TYPES = new Set<string>(['hd-derived-p256', 'xhd-derived-p256'])

/**
 * Converts the raw keystore `key.id` into the WebAuthn credentialId. This MUST
 * match `@perawallet/wallet-extension-passkeys`' `toUrlSafeBase64(key.id)` so a
 * credential created here is recognised by the passkey UI/autofill projection.
 *
 * The keystore id is plain ASCII, so encoding it as UTF-8 bytes then
 * base64url-ing them is equivalent to url-safe-base64 of the string.
 */
const credentialIdForKeyId = (keyId: string): string =>
    toBase64Url(new TextEncoder().encode(keyId))

const findSeedKeyId = (): string => {
    const seed = getKeystoreStore().state.keys.find(k =>
        SEED_KEY_TYPES.has(k.type),
    )
    if (!seed) {
        throw new Error(
            'keystoreCredentials: no HD seed in keystore to derive a P256 credential from',
        )
    }
    return seed.id
}

// Deterministic id for the `hd-root-key` parent so repeated derivations re-use
// (and overwrite) the same committed root rather than accumulating duplicates.
// The id must be stable across sessions so `signP256` — which resolves the
// derived key's `metadata.parentKeyId` — always finds a committed parent.
const rootKeyIdForSeed = (seedId: string): string =>
    `liquid-auth-p256-root:${seedId}`

/**
 * Ensures an `hd-root-key` derived from `seedId` exists in the keystore and
 * returns its id.
 *
 * The keystore's P256 derivation requires a committed `hd-root-key` parent: the
 * domain key's `metadata.parentKeyId` points at it, and `sign` re-resolves that
 * parent to re-derive the keypair. Generating the P256 key directly off a
 * `seed`/`hd-seed` builds the root internally but never commits it, leaving
 * `metadata.parentKeyId` dangling — so signing would later fail with
 * `KeyNotFound`. We therefore materialise (and persist) the root first, under a
 * deterministic id, then derive the P256 key from it.
 */
const ensureRootKeyId = async (seedId: string): Promise<string> => {
    const keyStore = getProvider().key.store
    const rootKeyId = rootKeyIdForSeed(seedId)
    const existing = getKeystoreStore().state.keys.find(
        k => k.id === rootKeyId && k.type === 'hd-root-key',
    )
    if (existing) return rootKeyId
    await keyStore.generate({
        type: 'hd-root-key',
        algorithm: 'raw',
        extractable: true,
        keyUsages: ['deriveKey', 'deriveBits'],
        params: { parentKeyId: seedId, id: rootKeyId },
    })
    return rootKeyId
}

/**
 * The derived `hd-derived-p256` key carries its 64-byte (x ‖ y) public key on
 * the reactive store snapshot. We read it there rather than calling
 * `key.store.export`, which would also return the private seed material.
 */
const readPublicKeyXY = (keyId: string): P256PublicKeyXY => {
    const key = getKeystoreStore().state.keys.find(k => k.id === keyId)
    const pk = key?.publicKey
    if (!pk || pk.length !== 64) {
        throw new Error(
            `keystoreCredentials: derived P256 key ${keyId} has no 64-byte public key`,
        )
    }
    return { x: pk.slice(0, 32), y: pk.slice(32, 64) }
}

const isP256Key = (key: Key): boolean => P256_KEY_TYPES.has(key.type)

/**
 * Wires {@link P256KeyAccess} to the real keystore backend. Native-coupled, so
 * not unit-tested: the orchestration is covered via the injectable core.
 */
export const createKeystoreP256KeyAccess = (): P256KeyAccess => ({
    deriveP256: async ({ origin, userHandle }) => {
        const keyStore = getProvider().key.store
        if (!keyStore.generate) {
            throw new Error(
                'keystoreCredentials: keystore backend does not implement generate',
            )
        }
        const seedKeyId = findSeedKeyId()
        // Materialise the committed `hd-root-key` parent up front so the derived
        // key's `metadata.parentKeyId` resolves when signing later.
        const rootKeyId = await ensureRootKeyId(seedKeyId)
        // dp256 lowercases the userHandle during derivation; mirror it so the
        // re-derived key (and its metadata) is stable across create/get.
        const normalizedUserHandle = userHandle.toLowerCase()
        // The domain params (origin/userHandle/counter) ride on `params`; the
        // keystore spreads them onto the key's metadata and `genDomainSpecific
        // KeyPair` reads them from there. `keyUsages: ['sign']` matches the P256
        // signing usage. The 64-byte (x ‖ y) public key lands on the store
        // snapshot — the private key never enters JS.
        const keyId = await keyStore.generate({
            type: 'hd-derived-p256',
            algorithm: 'P256',
            extractable: true,
            keyUsages: ['sign'],
            params: {
                parentKeyId: rootKeyId,
                origin,
                userHandle: normalizedUserHandle,
                counter: 0,
            },
        })
        return {
            keyId,
            credentialId: credentialIdForKeyId(keyId),
            publicKeyXY: readPublicKeyXY(keyId),
        }
    },

    getP256: async credentialId => {
        const match = getKeystoreStore().state.keys.find(
            k => isP256Key(k) && credentialIdForKeyId(k.id) === credentialId,
        )
        if (!match) return null
        return {
            keyId: match.id,
            publicKeyXY: readPublicKeyXY(match.id),
        }
    },

    signP256: async (keyId, bytes) => {
        // The keystore signs the bytes as-is (dp256 uses noble `prehash:false`),
        // returning a raw 64-byte r‖s signature — exactly what WebAuthn wants
        // once the caller has computed sha256(authData ‖ sha256(clientData)).
        return getProvider().key.store.sign(keyId, bytes)
    },
})

/**
 * Default biometric user-verification gate using the platform biometrics
 * service. Returns `true` when biometrics are unavailable so the ceremony is
 * not hard-blocked on devices without an enrolled biometric.
 */
const defaultRequireUserVerification = async (): Promise<boolean> => {
    const biometrics = getProvider().biometrics
    const available = await biometrics.checkBiometricsAvailable()
    if (!available) return true
    return biometrics.authenticate({
        title: 'Verify it’s you',
        description: 'Authenticate to use your Liquid Auth passkey.',
    })
}

/**
 * Builds the keystore-backed, in-app WebAuthn credential mechanism wired to the
 * real keystore P256 keys and the platform biometric prompt. No OS passkey UI
 * is involved — keys live in Pera's secure keystore.
 */
export const createKeystoreCredentialMechanism = (params?: {
    requireUserVerification?: () => Promise<boolean>
}): KeystoreCredentialMechanism =>
    createKeystoreCredentialMechanismCore({
        keyAccess: createKeystoreP256KeyAccess(),
        requireUserVerification:
            params?.requireUserVerification ?? defaultRequireUserVerification,
    })

export type { CredentialMechanism }
