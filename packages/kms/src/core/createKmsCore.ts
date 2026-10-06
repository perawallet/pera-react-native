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

import nacl from 'tweetnacl'
import { bytesToHex } from '@noble/hashes/utils.js'
import type {
    DeriveOptions,
    Key,
    KeyId,
    KeyStoreAPI,
} from '@algorandfoundation/keystore-core'
import type { Optional } from '@perawallet/wallet-core-shared'
import {
    InvalidKeyError,
    KeyAccessError,
    KeyManagementError,
    KeyNotFoundError,
} from '../errors'
import { SeedScheme } from '../constants'
import { bip39SeedFromEntropy } from '../crypto/hdwallet-utils'
import {
    deriveSecp256k1PrivateKey,
    isValidSecp256k1PrivateKey,
    parseBip32Path,
    secp256k1PublicKeyOf,
    signSecp256k1,
} from '../crypto/secp256k1'
import { handOffSecret, zeroBytes } from '../crypto/secure-memory'
import {
    SECP256K1_KEY_SCHEME,
    encodeSecp256k1Signature,
    isSecp256k1Key,
    type Secp256k1KeyMetadata,
    type Secp256k1KeyOrigin,
    type Secp256k1Signature,
} from '../models/keys'
import { entropyChildIdOf, expiresAtOf, seedSchemeOf } from '../utils'
import { checkAccess as defaultCheckAccess } from './access'
import { parentIdOf, resolveSeedKeyFrom } from './resolveSeed'
import type {
    KmsDerivationRequest,
    KmsDerivedKey,
    KmsImportRequest,
    KmsKeyScheme,
    Secp256k1ChildRef,
    Secp256k1DerivationRequest,
    Secp256k1ImportRequest,
} from './types'

// secp256k1 has no keystore backend, so it is served from the secrets store
// below rather than through `keyStore.deriveFromSeed`/`import`/`sign`.
const KEYSTORE_NATIVE_SCHEMES: ReadonlySet<string> = new Set<KmsKeyScheme>([
    'ed25519',
])

const ED25519_SEED_LENGTH = 32
const SECP256K1_DIGEST_LENGTH = 32

export type KmsCoreDeps = {
    /** Read per call: the provider is registered at boot, after module evaluation. */
    keyStore: () => KeyStoreAPI
    keys: () => readonly Key[]
    checkAccess?: (key: Key, domain: string) => void
    /** Seed that governs `id`'s access; throws when there is none. */
    resolveSeedKey?: (id: string) => Key
}

export type KmsCore = ReturnType<typeof createKmsCore>

const assertSupportedScheme = (scheme: string): void => {
    if (!KEYSTORE_NATIVE_SCHEMES.has(scheme)) {
        throw new KeyManagementError(`Unsupported key scheme: ${scheme}`)
    }
}

const assertId = (id: string | undefined): void => {
    if (typeof id !== 'string' || id.length === 0) {
        throw new KeyManagementError('A key id is required')
    }
}

export const createKmsCore = (deps: KmsCoreDeps) => {
    const checkAccess = deps.checkAccess ?? defaultCheckAccess

    // Non-mutating: removing an expired seed stays the store binding's job.
    const resolveSeedKey =
        deps.resolveSeedKey ??
        ((id: string): Key => {
            const seed = resolveSeedKeyFrom(deps.keys(), id)
            const expiresAt = expiresAtOf(seed)
            if (expiresAt && Date.now() > expiresAt.getTime()) {
                throw new KeyNotFoundError(seed.id)
            }
            return seed
        })

    /** Derives and persists the child, returning only its keystore id. */
    const deriveChild = async (
        seedKeyId: KeyId,
        request: KmsDerivationRequest,
        domain: string,
    ): Promise<KeyId> => {
        assertSupportedScheme(request.scheme)
        assertId(request.id)
        const keyStore = deps.keyStore()
        if (!keyStore.deriveFromSeed) {
            throw new KeyManagementError(
                'Keystore backend does not implement deriveFromSeed',
            )
        }
        checkAccess(resolveSeedKey(seedKeyId), domain)
        return keyStore.deriveFromSeed(seedKeyId, request.path, {
            ...(request.params as Partial<DeriveOptions>),
            algorithm: 'EdDSA',
            id: request.id,
        })
    }

    const deriveFromSeed = async (
        seedKeyId: KeyId,
        request: KmsDerivationRequest,
        domain: string,
    ): Promise<KmsDerivedKey> => {
        if (request.scheme === SECP256K1_KEY_SCHEME) {
            return deriveSecp256k1Child(seedKeyId, request, domain)
        }
        const keyPairId = await deriveChild(seedKeyId, request, domain)
        // Derived children are `extractable: false`, so `export` would throw;
        // the store snapshot keeps the public half.
        const derived = deps.keys().find(k => k.id === keyPairId)
        if (!derived?.publicKey) {
            throw new KeyManagementError(
                'Derived key does not have a public key',
            )
        }
        return { keyPairId, publicKey: new Uint8Array(derived.publicKey) }
    }

    /**
     * Imports a raw Ed25519 private key (the 32-byte seed). `bytes` is zeroed
     * before this returns or throws, whatever the outcome.
     */
    const importRawKey = async (
        bytes: Uint8Array,
        request: KmsImportRequest,
        domain: string,
    ): Promise<KmsDerivedKey> => {
        if (request.scheme === SECP256K1_KEY_SCHEME) {
            return importSecp256k1Key(bytes, request, domain)
        }
        let pair: Optional<nacl.SignKeyPair>
        try {
            assertSupportedScheme(request.scheme)
            assertId(request.id)
            if (bytes.length !== ED25519_SEED_LENGTH) {
                throw new InvalidKeyError(request.id)
            }
            const { id, parentKeyId } = request
            // A parentless import is checked as the record it would become,
            // so `aclOf`'s fail-closed default applies.
            const governingKey: Key = parentKeyId
                ? resolveSeedKey(parentKeyId)
                : {
                      id,
                      type: 'ed25519',
                      algorithm: 'EdDSA',
                      extractable: false,
                      metadata: {},
                  }
            checkAccess(governingKey, domain)

            // Supplying `publicKey` makes the engine verify the pair.
            pair = nacl.sign.keyPair.fromSeed(bytes)
            const publicKey = new Uint8Array(pair.publicKey)
            const keyPairId = await deps.keyStore().import(
                {
                    id,
                    type: 'ed25519',
                    algorithm: 'EdDSA',
                    extractable: false,
                    keyUsages: ['sign', 'verify'],
                    privateKey: bytes,
                    publicKey,
                    metadata: parentKeyId ? { parentKeyId } : {},
                },
                'raw',
            )
            return { keyPairId, publicKey }
        } finally {
            zeroBytes(bytes, pair?.secretKey)
        }
    }

    /** Signs each payload as given: no prefix, no hashing. */
    const signEach = async (
        keyPairId: KeyId,
        payloads: Uint8Array[],
        domain: string,
    ): Promise<Uint8Array[]> => {
        checkAccess(resolveSeedKey(keyPairId), domain)
        const keyStore = deps.keyStore()
        return Promise.all(payloads.map(p => keyStore.sign(keyPairId, p)))
    }

    /**
     * For a secp256k1 key `payload` must be the 32-byte digest, and the result
     * is `r‖s‖recovery` (see `encodeSecp256k1Signature`).
     */
    const sign = async (
        keyPairId: KeyId,
        payload: Uint8Array,
        domain: string,
    ): Promise<Uint8Array> => {
        if (isSecp256k1Key(deps.keys().find(k => k.id === keyPairId))) {
            return encodeSecp256k1Signature(
                await signSecp256k1Digest(keyPairId, payload, domain),
            )
        }
        const [signature] = await signEach(keyPairId, [payload], domain)
        return signature
    }

    const secretStore = () => {
        const { secrets } = deps.keyStore()
        if (!secrets) {
            throw new KeyManagementError(
                'Keystore backend does not implement secrets',
            )
        }
        return secrets
    }

    const secp256k1MetadataOf = (key: Key): Secp256k1KeyMetadata =>
        key.metadata as Secp256k1KeyMetadata

    const findSecp256k1Key = (keyPairId: KeyId): Key => {
        const key = deps.keys().find(k => k.id === keyPairId)
        if (!key) throw new KeyNotFoundError(keyPairId)
        if (!isSecp256k1Key(key)) throw new InvalidKeyError(keyPairId)
        return key
    }

    // A parentless imported key has no seed: its own entry carries the ACL,
    // and `aclOf` applies the fail-closed default to it.
    const governingKeyOf = (key: Key): Key =>
        parentIdOf(key) ? resolveSeedKey(key.id) : key

    /**
     * Writes the key unless `id` already holds it. Anything else under the
     * same id is a collision, never an overwrite: a different key, or the same
     * key with another origin or parent, which would change whether it can be
     * exported.
     */
    const storeSecp256k1Key = async (
        privateKey: Uint8Array,
        request: { id: string; parentKeyId?: string },
        origin: Secp256k1KeyOrigin,
    ): Promise<Secp256k1ChildRef> => {
        const publicKey = secp256k1PublicKeyOf(privateKey)
        const existing = deps.keys().find(k => k.id === request.id)
        if (existing) {
            const stored = isSecp256k1Key(existing)
                ? secp256k1MetadataOf(existing)
                : undefined
            const matches =
                stored?.pera.publicKey === bytesToHex(publicKey) &&
                stored.pera.origin === origin &&
                stored.parentKeyId === request.parentKeyId
            if (!matches) {
                throw new KeyManagementError(
                    `Key id ${request.id} already holds another entry`,
                )
            }
            return { keyPairId: request.id, publicKey }
        }
        const metadata: Secp256k1KeyMetadata = {
            ...(request.parentKeyId
                ? { parentKeyId: request.parentKeyId }
                : {}),
            pera: {
                keyScheme: SECP256K1_KEY_SCHEME,
                origin,
                publicKey: bytesToHex(publicKey),
            },
        }
        const keyPairId = await secretStore().put(privateKey, {
            id: request.id,
            metadata,
        })
        return { keyPairId, publicKey }
    }

    /** Derives the BIP-32 child at `request.path` under a BIP-39 seed and stores it. */
    const deriveSecp256k1Child = async (
        seedKeyId: KeyId,
        request: Secp256k1DerivationRequest,
        domain: string,
    ): Promise<Secp256k1ChildRef> => {
        assertId(request.id)
        // Fail before the entropy is decrypted and PBKDF2 runs.
        parseBip32Path(request.path)
        const seed = resolveSeedKey(seedKeyId)
        checkAccess(seed, domain)
        if (seedSchemeOf(seed) !== SeedScheme.Bip39) {
            throw new KeyManagementError(
                'secp256k1 keys derive from a BIP-39 seed only',
            )
        }
        const entropyId = entropyChildIdOf(seed.id, deps.keys())
        if (!entropyId) {
            throw new KeyManagementError(
                'HD seed is missing its entropy secret',
            )
        }

        let entropy: Optional<Uint8Array>
        let bip39Seed: Optional<Uint8Array>
        let privateKey: Optional<Uint8Array>
        try {
            entropy = await secretStore().get(entropyId)
            bip39Seed = await bip39SeedFromEntropy(entropy)
            privateKey = deriveSecp256k1PrivateKey(bip39Seed, request.path)
            return await storeSecp256k1Key(
                privateKey,
                { id: request.id, parentKeyId: seed.id },
                'derived',
            )
        } finally {
            zeroBytes(entropy, bip39Seed, privateKey)
        }
    }

    /**
     * Imports a raw 32-byte secp256k1 private key. `privateKey` is zeroed
     * before this returns or throws, whatever the outcome.
     */
    const importSecp256k1Key = async (
        privateKey: Uint8Array,
        request: Secp256k1ImportRequest,
        domain: string,
    ): Promise<Secp256k1ChildRef> => {
        try {
            if (!isValidSecp256k1PrivateKey(privateKey)) {
                throw new InvalidKeyError(request.id)
            }
            assertId(request.id)
            // A parentless import is checked as the record it would become.
            const governingKey: Key = request.parentKeyId
                ? resolveSeedKey(request.parentKeyId)
                : {
                      id: request.id,
                      type: 'secret-key',
                      algorithm: 'raw',
                      extractable: false,
                      metadata: {},
                  }
            checkAccess(governingKey, domain)
            return await storeSecp256k1Key(privateKey, request, 'imported')
        } finally {
            zeroBytes(privateKey)
        }
    }

    /** Signs a 32-byte digest as given: no prefix, no hashing. */
    const signSecp256k1Digest = async (
        keyPairId: KeyId,
        digest: Uint8Array,
        domain: string,
    ): Promise<Secp256k1Signature> => {
        if (digest.length !== SECP256K1_DIGEST_LENGTH) {
            throw new KeyManagementError(
                'A secp256k1 digest must be exactly 32 bytes',
            )
        }
        checkAccess(governingKeyOf(findSecp256k1Key(keyPairId)), domain)
        let privateKey: Optional<Uint8Array>
        try {
            privateKey = await secretStore().get(keyPairId)
            return signSecp256k1(digest, privateKey)
        } finally {
            zeroBytes(privateKey)
        }
    }

    /**
     * The private key of an imported entry, for the reveal screen. A derived
     * child is never exported: its seed's phrase is the backup. The caller
     * zeroes the result.
     */
    const exportSecp256k1Key = async (
        keyPairId: KeyId,
        domain: string,
    ): Promise<Uint8Array> => {
        const key = findSecp256k1Key(keyPairId)
        if (secp256k1MetadataOf(key).pera.origin !== 'imported') {
            throw new KeyAccessError()
        }
        checkAccess(governingKeyOf(key), domain)
        return handOffSecret(await secretStore().get(keyPairId))
    }

    return {
        deriveChild,
        deriveFromSeed,
        importRawKey,
        signEach,
        sign,
        deriveSecp256k1Child,
        importSecp256k1Key,
        signSecp256k1Digest,
        exportSecp256k1Key,
    }
}
