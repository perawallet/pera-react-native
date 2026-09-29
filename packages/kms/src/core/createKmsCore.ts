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
import { zeroBytes } from '../crypto/secure-memory'
import { expiresAtOf } from '../utils'
import { checkAccess as defaultCheckAccess } from './access'
import { resolveSeedKeyFrom } from './resolveSeed'
import type {
    KmsDerivationRequest,
    KmsDerivedKey,
    KmsImportRequest,
    KmsKeyScheme,
} from './types'

const SUPPORTED_SCHEMES: ReadonlySet<string> = new Set<KmsKeyScheme>([
    'ed25519',
])

const ED25519_SEED_LENGTH = 32

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
    if (!SUPPORTED_SCHEMES.has(scheme)) {
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

    const sign = async (
        keyPairId: KeyId,
        payload: Uint8Array,
        domain: string,
    ): Promise<Uint8Array> => {
        const [signature] = await signEach(keyPairId, [payload], domain)
        return signature
    }

    return { deriveChild, deriveFromSeed, importRawKey, signEach, sign }
}
