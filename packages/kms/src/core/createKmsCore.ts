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
import type {
    DeriveOptions,
    Key,
    KeyId,
    KeyStoreAPI,
} from '@algorandfoundation/keystore-core'
import type { Optional } from '@perawallet/wallet-core-shared'
import {
    InvalidKeyError,
    KeyManagementError,
    KeyNotFoundError,
} from '../errors'
import { SeedScheme } from '../constants'
import { zeroBytes } from '../crypto/secure-memory'
import {
    SECP256K1_DERIVED_KEY_TYPE,
    SECP256K1_IMPORTED_KEY_TYPE,
    SECP256K1_KEY_ALGORITHM,
    decodeSecp256k1Signature,
    encodeSecp256k1Signature,
    isSecp256k1Key,
    isValidSecp256k1PrivateKey,
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

// secp256k1 runs through the keystore's secp256k1 shim, not the ed25519
// `deriveChild`/`importRawKey` paths below.
const KEYSTORE_NATIVE_SCHEMES: ReadonlySet<string> = new Set<KmsKeyScheme>([
    'ed25519',
])

const SECP256K1_SCHEME: KmsKeyScheme = 'secp256k1'
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
        if (request.scheme === SECP256K1_SCHEME) {
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
        if (request.scheme === SECP256K1_SCHEME) {
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

    const publicKeyOf = (keyPairId: KeyId): Uint8Array => {
        const key = deps.keys().find(k => k.id === keyPairId)
        if (!key?.publicKey) {
            throw new KeyManagementError('Keystore entry has no public key')
        }
        return new Uint8Array(key.publicKey)
    }

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
     * Derives the BIP-32 child at `request.path` from an HD wallet's BIP39
     * entropy. The keystore opens the entropy, seals the child and returns only
     * its public key; re-deriving the same id and path never reopens it.
     */
    const deriveSecp256k1Child = async (
        seedKeyId: KeyId,
        request: Secp256k1DerivationRequest,
        domain: string,
    ): Promise<Secp256k1ChildRef> => {
        assertId(request.id)
        const seed = resolveSeedKey(seedKeyId)
        checkAccess(seed, domain)
        if (seedSchemeOf(seed) !== SeedScheme.Bip39) {
            throw new KeyManagementError(
                'secp256k1 keys derive from an HD wallet only',
            )
        }
        const existing = deps.keys().find(k => k.id === request.id)
        if (existing) {
            const sameChild =
                existing.type === SECP256K1_DERIVED_KEY_TYPE &&
                parentIdOf(existing) === seed.id &&
                existing.metadata?.path === request.path
            if (!sameChild) {
                throw new KeyManagementError(
                    `Key id ${request.id} already holds another entry`,
                )
            }
            return { keyPairId: request.id, publicKey: publicKeyOf(request.id) }
        }
        const entropyId = entropyChildIdOf(seed.id, deps.keys())
        if (!entropyId) {
            throw new KeyManagementError(
                'HD seed is missing its entropy secret',
            )
        }
        const keyStore = deps.keyStore()
        if (!keyStore.deriveFromSeed) {
            throw new KeyManagementError(
                'Keystore backend does not implement deriveFromSeed',
            )
        }
        const keyPairId = await keyStore.deriveFromSeed(
            entropyId,
            request.path,
            {
                algorithm: SECP256K1_KEY_ALGORITHM,
                curve: 'secp256k1',
                id: request.id,
                // The engine would record the entropy secret as the parent; the
                // seed is what access, expiry and removal resolve through.
                metadata: { parentKeyId: seed.id },
            },
        )
        return { keyPairId, publicKey: publicKeyOf(keyPairId) }
    }

    /**
     * Seals a raw 32-byte secp256k1 private key in the keystore. `privateKey`
     * is zeroed before this returns or throws, whatever the outcome.
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
            const { id, parentKeyId } = request
            // A parentless import is checked as the record it would become.
            const governingKey: Key = parentKeyId
                ? resolveSeedKey(parentKeyId)
                : {
                      id,
                      type: SECP256K1_IMPORTED_KEY_TYPE,
                      algorithm: SECP256K1_KEY_ALGORITHM,
                      extractable: false,
                      metadata: {},
                  }
            checkAccess(governingKey, domain)
            if (deps.keys().some(k => k.id === id)) {
                throw new KeyManagementError(
                    `Key id ${id} already holds another entry`,
                )
            }
            const keyPairId = await deps.keyStore().import(
                {
                    id,
                    type: SECP256K1_IMPORTED_KEY_TYPE,
                    algorithm: SECP256K1_KEY_ALGORITHM,
                    extractable: false,
                    keyUsages: ['sign', 'verify'],
                    privateKey,
                    metadata: parentKeyId ? { parentKeyId } : {},
                },
                'raw',
            )
            return { keyPairId, publicKey: publicKeyOf(keyPairId) }
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
        return decodeSecp256k1Signature(
            await deps.keyStore().sign(keyPairId, digest),
        )
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
    }
}
