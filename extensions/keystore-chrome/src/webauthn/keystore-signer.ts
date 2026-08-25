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

import { InvalidKeyDataError, type Key, type KeyStoreState } from '../keystore'
import type { Store } from '@tanstack/store'
import {
    bytesToB64url,
    deriveCredentialId,
    isPasskeyKey,
    splitP256PublicKey,
    type KeystoreSigner,
} from '@perawallet/wallet-core-passkeys/webauthn'

/**
 * TRAP — do not route this through `keystore-chrome`'s own `store.ts`
 * (`chrome.storage.local`, `keystore:` prefix). Web key storage moved to the
 * keystore-web engine (IndexedDB), leaving that bucket permanently empty, and
 * anything written there is invisible to Settings > Passkeys and `signP256`.
 *
 * The engine mints credentials only through `deriveDomainKey`, which rejects
 * any parent that is not an `hd-root-key` carrying
 * `metadata.scheme === 'pbkdf2-p256'` (`keystore-core` `create.js:774`).
 *
 * TRAP — that main key must parent on the wallet's **entropy child**, not the
 * wallet root: `generateDP256Main` PBKDF2s the parent's raw stored bytes
 * (`create.js:449-462`, `wantSeed: false`), so the 96-byte extended root and
 * the 16/32-byte entropy give different main keys from one mnemonic. Mobile's
 * writers (`usePasskeyMainKey`, `repairs/0003-mint-passkey-main-key`) use the
 * entropy child and sort their root pick; `resolveMainKeyId` matches both, or a
 * seed phrase restores different passkeys per platform.
 */

/** Distinguishes the passkey main key from the wallet's XHD root, which shares its `hd-root-key` type. */
const PBKDF2_P256_SCHEME = 'pbkdf2-p256'

/**
 * Restated from `extensions/provider/src/keystore/passkeyMainKey.ts` rather
 * than imported: that package resolves `@algorandfoundation/react-native-keystore`
 * -> `react-native-mmkv`, which is why `@perawallet/wallet-core-passkeys`
 * splits the `/webauthn` subpath this port consumes (`webauthn.ts:18-25`).
 *
 * Both copies assert the same literal — `keystore-signer.test.ts` here,
 * `passkeyMainKey.spec.ts` in provider — so either one drifting alone fails its
 * own suite.
 */
const passkeyMainKeyId = (seedKeyId: string): string =>
    `${seedKeyId}-passkey-main`

/**
 * Types a wallet root can carry. `hd-root-key` is what `useHDWallet` writes
 * today; `seed`/`hd-seed` cover a wallet imported before that relabel.
 */
const WALLET_ROOT_TYPES: ReadonlySet<string> = new Set([
    'hd-root-key',
    'seed',
    'hd-seed',
])

/**
 * The slice of the keystore engine this adapter drives. Structural rather
 * than the concrete engine type: the React Native and web builds resolve
 * different concrete keystores, and both satisfy this.
 */
export type PasskeyKeyStore = {
    generate: (options: {
        type: string
        algorithm?: string
        extractable?: boolean
        keyUsages?: string[]
        params?: Record<string, unknown>
    }) => Promise<string>
    /** Optional on the engine's own type, so callers must null-check it. */
    deriveDomainKey?: (
        mainKeyId: string,
        options: {
            algorithm: string
            origin?: string
            userHandle?: string
            counter?: number
            id?: string
            metadata?: Record<string, unknown>
        },
    ) => Promise<string>
    sign: (id: string, data: Uint8Array) => Promise<Uint8Array>
}

const readMetadataString = (key: Key, field: string): string | undefined => {
    const value = (key.metadata as Record<string, unknown> | undefined)?.[field]
    return typeof value === 'string' ? value : undefined
}

const isPasskeyMainKey = (key: Key): boolean =>
    key.type === 'hd-root-key' &&
    readMetadataString(key, 'scheme') === PBKDF2_P256_SCHEME

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

/** The seed's BIP39 entropy `secret-key` child, located by its metadata. */
const entropyChildIdOf = (
    seedKeyId: string,
    keys: readonly Key[],
): string | undefined =>
    keys.find(key => {
        const meta = (key.metadata ?? {}) as {
            parentKeyId?: unknown
            entropyKey?: unknown
        }
        return (
            key.type === 'secret-key' &&
            meta.entropyKey === true &&
            meta.parentKeyId === seedKeyId
        )
    })?.id

/**
 * Finds the persisted `pbkdf2-p256` main key, or derives one from the
 * wallet's BIP39 entropy. Exactly one is ever created: every credential
 * shares it, so losing it would orphan all of them at once.
 */
const resolveMainKeyId = async (
    keystore: PasskeyKeyStore,
    store: Store<KeyStoreState>,
): Promise<string> => {
    const existing = store.state.keys.find(isPasskeyMainKey)
    if (existing) return existing.id

    // Lowest-sorted root with an entropy child wins, matching `repairs/0003`
    // (`:156-162`) and `useKMS.removeKeyAndChildren`: the device gets exactly
    // one main key, so a store-order pick would name a different root here than
    // mobile does from the same seeds.
    const roots = store.state.keys
        .filter(
            key => WALLET_ROOT_TYPES.has(key.type) && !isPasskeyMainKey(key),
        )
        // Code-unit order, NOT `localeCompare`: the other two writers use a
        // bare `.sort()`, and a locale-aware collation would disagree with them
        // on case and punctuation.
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    const [firstRoot] = roots
    if (!firstRoot) {
        throw new InvalidKeyDataError(
            'No wallet root found in the keystore; cannot derive a WebAuthn P-256 credential.',
        )
    }
    // Falling back to `firstRoot` keeps the "no entropy child" error below for
    // the case where no root has one at all.
    const walletRoot =
        roots.find(root => entropyChildIdOf(root.id, store.state.keys)) ??
        firstRoot

    const entropyChildId = entropyChildIdOf(walletRoot.id, store.state.keys)
    if (!entropyChildId) {
        throw new InvalidKeyDataError(
            `Wallet root ${walletRoot.id} has no BIP39 entropy child; cannot derive a WebAuthn P-256 credential.`,
        )
    }

    return keystore.generate({
        type: 'hd-root-key',
        // `algorithm: 'P256'` is what selects the PBKDF2 main-key branch over
        // the XHD-root one; they share the `hd-root-key` type.
        algorithm: 'P256',
        extractable: false,
        keyUsages: ['deriveBits', 'deriveKey'],
        params: {
            parentKeyId: entropyChildId,
            id: passkeyMainKeyId(walletRoot.id),
        },
    })
}

/**
 * Builds a {@link KeystoreSigner} over the extension's live keystore engine
 * and its reactive store. Pass the same pair the background context uses
 * (`getKeystore()` / `getKeystoreStore()` from `extensions/provider`) so
 * every credential this mints and signs is visible to the rest of the
 * extension.
 */
export const createKeystoreSigner = (
    keystore: PasskeyKeyStore,
    store: Store<KeyStoreState>,
): KeystoreSigner => ({
    async createP256Credential({
        rpId,
        userHandle,
        userHandleOriginalB64Url,
        displayName,
        userName,
    }) {
        const deriveDomainKey = keystore.deriveDomainKey
        if (!deriveDomainKey) {
            throw new InvalidKeyDataError(
                'Keystore backend does not implement deriveDomainKey; cannot mint a WebAuthn P-256 credential.',
            )
        }

        const mainKeyId = await resolveMainKeyId(keystore, store)

        // Redundant today (the core already lowercases), but load-bearing if
        // that changes: the engine re-derives the child at sign time from the
        // stored `metadata.userHandle`, so a non-lowercase value here would
        // produce a different keypair than the public key returned at
        // registration and every assertion would fail verification.
        const normalizedUserHandle = userHandle.toLowerCase()

        const keyId = await deriveDomainKey.call(keystore, mainKeyId, {
            algorithm: 'P256',
            origin: rpId,
            userHandle: normalizedUserHandle,
            counter: 0,
            metadata: {
                // Byte-exact base64url of the RP's original `user.id` bytes —
                // separate from `userHandle` (the lossy derivation input).
                // NEVER fed into key derivation; only used by
                // `listP256Credentials` to answer with the real `user.id` on
                // assertion.
                userHandleOriginal: userHandleOriginalB64Url,
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
        // Hand the payload over UNHASHED. dp256's own signer is a raw ECDSA
        // primitive that treats its input as an already-computed digest, but
        // the engine's Deterministic-P256 shim SHA-256s before calling it, so
        // it already emits a standards-compliant ES256 signature over
        // `SHA256(authenticatorData || clientDataHash)`. Pre-hashing here
        // would sign `SHA256(SHA256(…))` and every relying party's verify
        // would fail — which is exactly what the passkey-provider e2e caught.
        //
        // Raw 64-byte (r ‖ s) comes back out; the port's core DER-encodes, so
        // this adapter must not.
        return keystore.sign(keyId, data)
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

                // Prefer the byte-exact original `user.id` persisted alongside
                // the derivation `userHandle`. Fall back to base64url of the
                // (lowercased, lossy) derivation string only for a key minted
                // before this field existed — that fallback is NOT
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
                        // Registration-time labels, so a picker can name each
                        // identity rather than showing opaque key ids.
                        displayName: readMetadataString(key, 'displayName'),
                        userName: readMetadataString(key, 'userName'),
                    },
                ]
            })
    },
})
