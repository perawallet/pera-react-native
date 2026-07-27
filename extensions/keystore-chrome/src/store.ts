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

// Ported from @algorandfoundation/react-native-keystore@1.0.0-canary.12 store.ts
// oxlint-disable @typescript-eslint/no-explicit-any, unicorn/numeric-separators-style, no-empty -- ported verbatim from react-native-keystore; casts and style preserved from source

import {
    type Algorithm,
    clearKeyData,
    clearKeyStore,
    type DeriveOptions,
    generateKey as generateKeyStoreKey,
    InvalidKeyDataError,
    InvalidKeyFormatError,
    type KeyData,
    type KeyId,
    KeyNotFoundError,
    type KeyStoreState,
    type KeyType,
    removeKey as removeKeystoreKey,
    requiresParentKey,
    type SeedData,
    setStatus,
    type XHDDerivedKeyData,
    type XHDDomainP256KeyData,
    type XHDRootKey,
} from '@algorandfoundation/keystore'

import { clearBuffer, generateId } from '@algorandfoundation/wallet-provider'
import {
    BIP32DerivationType,
    KeyContext,
} from '@algorandfoundation/xhd-wallet-api'

import {
    crypto_generichash,
    crypto_secretbox_open_easy,
} from '@algorandfoundation/xhd-wallet-api/dist/sumo.facade.js'
import type { Store } from '@tanstack/store'
import type {
    BufferLike,
    CryptoKey,
    EncryptDecryptParams,
    SubtleAlgorithm,
} from './quick-crypto-types'
import { DecodingError } from './errors'
import { dp256, xhd } from './libs'
import { commit, fetchSecret } from './storage/state'
import { storage } from './storage/chrome-storage'
import type { AuthenticationOptions } from './types'

/**
 * Type guard for {@link SeedData}.
 *
 * Accepts both the canonical `seed` type and the legacy `hd-seed` shape so
 * that callers transitioning to the new model continue to work without
 * changes.
 */
function isSeedData(key: any): key is SeedData {
    return key?.type === 'seed' || key?.type === 'hd-seed'
}

/**
 * Type guard for XHDRootKey
 */
function isXHDRootKey(key: any): key is XHDRootKey {
    return key?.type === 'hd-root-key'
}

/**
 * Removes a key from the reactive store and persistent storage.
 * @param params - The removal parameters
 * @param params.store - The reactive store instance
 * @param params.keyId - The ID of the key to remove
 */
export async function removeKey({
    store,
    keyId,
}: {
    store: Store<KeyStoreState>
    keyId: string
}): Promise<void> {
    // Remove the key from storage
    storage.remove(keyId)
    removeKeystoreKey({ store, keyId })
}

/**
 * Clears all keys from the reactive store and persistent storage.
 * @param params - The clear parameters
 * @param params.store - The reactive store instance
 */
export async function clear({
    store,
}: {
    store: Store<KeyStoreState>
}): Promise<void> {
    clearKeyStore({ store })
    storage.clearAll()
}

/**
 * Generates a new key pair, stores it, and updates the reactive store.
 * Supports various algorithm types via options.
 * @param options - The generation parameters
 * @param options.store - The reactive store instance
 * @param options.algorithm - The algorithm to use for generation
 * @param options.extractable - Whether the private key can be exported
 * @param options.keyUsages - Intended usages for the key
 * @returns The generated KeyId
 */
export async function generateKey(options: {
    store: Store<KeyStoreState>
    type: KeyType
    algorithm: Algorithm
    extractable: boolean
    keyUsages: KeyUsage[]
    params?: Record<string, any>
    authenticationOptions?: AuthenticationOptions
}): Promise<KeyId> {
    const {
        store,
        algorithm,
        type,
        params,
        extractable = false,
        keyUsages = ['sign'],
        authenticationOptions,
    } = options
    const id = params?.id
    // Signal that we are generating a key
    setStatus({ store, status: 'generating' })

    let parentKey: XHDRootKey | SeedData | null = null
    let keyData: KeyData | null = null
    const parentRequired = requiresParentKey({ type })
    try {
        if (parentRequired && typeof params?.parentKeyId === 'undefined') {
            throw new InvalidKeyDataError(
                `XHD derived keys require a rootKeyId, please upload it first using importSeed()`,
            )
        }
        parentKey = parentRequired
            ? await fetchSecret<SeedData>({
                  keyId: params?.parentKeyId,
                  options: authenticationOptions,
              })
            : null
        if (parentRequired && !parentKey) {
            throw new KeyNotFoundError(params?.parentKeyId)
        }

        // Ensure the parentKey has the correct type for the core library
        // If it's a seed, it must be "hd-seed" and have format "raw"
        // (We already ensure this in importSeed/importKey)

        // Map our internal types to keystore types if needed.
        //
        // NOTE: `ed25519` deliberately stays as `ed25519` so that the core
        // keystore's `EdDSA` branch dispatches to `generateEd25519FromSeed`
        // when a `seed`/`hd-seed` parent is provided. Mapping it to `ecc`
        // (the previous behavior) routed it into the XHD/P256 path and
        // caused: "XHD derived keys require a rootKeyId" for plain seeds.
        const mappedType = type

        // If we are generating an XHD-derived P256 key, we need a root key.
        if (mappedType === 'hd-derived-p256' || algorithm === 'P256') {
            let rootKey: XHDRootKey | null = null
            if (isSeedData(parentKey)) {
                // Generate a temporary root key from the seed
                // oxlint-disable-next-line
                const rootKeyData = (await generateKeyStoreKey({
                    keyData: {
                        type: 'hd-root-key',
                        algorithm: 'raw',
                        format: 'raw',
                        metadata: { parentKeyId: parentKey.id },
                    } as any,
                    parentKey: {
                        ...parentKey,
                        type: 'hd-seed',
                        format: 'raw',
                    } as any,
                })) as XHDRootKey
                rootKey = rootKeyData
            } else if (isXHDRootKey(parentKey)) {
                rootKey = parentKey
            }

            if (!rootKey) {
                throw new InvalidKeyDataError(
                    `XHD derived keys require a rootKeyId, please upload it first using importSeed()`,
                )
            }

            const derivedKeyData = await generateKeyStoreKey({
                keyData: {
                    id: id || generateId(),
                    type: 'hd-derived-p256',
                    algorithm: 'P256',
                    extractable,
                    keyUsages: keyUsages,
                    metadata: {
                        ...params,
                        createdAt: new Date(),
                        parentKeyId: rootKey.id,
                    },
                } as any,
                parentKey: {
                    ...rootKey,
                    type: 'hd-root-key',
                    privateKey: rootKey.privateKey,
                } as any,
            })
            await commit({
                store,
                keyData: derivedKeyData,
                options: authenticationOptions,
            })
            if (parentKey && isSeedData(parentKey)) clearKeyData(rootKey)
            return derivedKeyData.id
        }

        // For root key generation, the parent MUST be an hd-seed with format raw
        // AND it must have the seed in privateKey.
        const finalParentKey = parentKey
            ? {
                  ...parentKey,
                  type:
                      isSeedData(parentKey) || mappedType === 'hd-root-key'
                          ? 'hd-seed'
                          : (parentKey as any).type,
                  format:
                      isSeedData(parentKey) || mappedType === 'hd-root-key'
                          ? 'raw'
                          : (parentKey as any).format,
                  privateKey: parentKey.privateKey,
                  seed: parentKey.privateKey,
                  key: parentKey.privateKey,
                  extractable: true, // Some libraries might check this
              }
            : null

        keyData = await generateKeyStoreKey({
            keyData: {
                id: id || generateId(),
                type: mappedType,
                algorithm,
                extractable,
                keyUsages: keyUsages,
                metadata: {
                    ...params,
                    createdAt: new Date(),
                },
            } as any,
            parentKey: finalParentKey as any,
        })

        // Persist the key to storage
        await commit({ store, keyData, options: authenticationOptions })

        // Return the generated key ID
        return keyData.id
    } finally {
        clearKeyData(keyData)
        clearKeyData(parentKey)
        setStatus({ store, status: 'idle' })
    }
}

export async function importSeed({
    store,
    seed,
    name,
    id,
    authenticationOptions,
}: {
    store: Store<KeyStoreState>
    seed: Uint8Array | string
    name?: string
    id?: KeyId
    authenticationOptions?: AuthenticationOptions
}): Promise<KeyId> {
    setStatus({ store, status: 'importing' })
    const keyId = id || generateId()

    let privateKey: Uint8Array
    const metadata: any = {}

    try {
        if (typeof seed === 'string') {
            throw new InvalidKeyDataError(
                'Mnemonic import is not implemented yet',
            )
        }
        privateKey = seed

        await commit({
            store,
            keyData: {
                id: keyId,
                type: 'seed',
                name: name || 'Imported Seed',
                algorithm: 'raw',
                format: 'bytes',
                extractable: true,
                keyUsages: ['deriveKey', 'deriveBits'],
                privateKey,
                metadata,
            } as SeedData,
            options: authenticationOptions,
        })
    } finally {
        setStatus({ store, status: 'idle' })
    }

    return keyId
}

export function parsePath(path: string): number[] {
    return path
        .replace(/^m\/?/, '')
        .split('/')
        .map(part => {
            const hardened = part.endsWith("'") || part.endsWith('h')
            const index = parseInt(part.replace(/['h]$/, ''), 10)
            return hardened ? index + 0x80000000 : index
        })
}

/**
 * Derives a new key from an existing seed in the keystore.
 * @param params - The derivation parameters
 * @param params.store - The reactive store instance
 * @param params.seedId - The ID of the seed to derive from
 * @param params.path - The derivation path
 * @param params.options - Optional derivation settings
 * @returns The ID of the derived key
 * @todo: Move to keystore
 */
export async function deriveFromSeed({
    store,
    seedId,
    path,
    options,
    authenticationOptions,
}: {
    store: Store<KeyStoreState>
    seedId: KeyId
    path: string
    options?: DeriveOptions
    authenticationOptions?: AuthenticationOptions
}): Promise<KeyId> {
    setStatus({ store, status: 'deriving' })

    let rootKey: XHDRootKey | SeedData | null = null
    let derivedKey: KeyData | XHDDerivedKeyData | XHDDomainP256KeyData | null =
        null
    try {
        const secret = await fetchSecret<KeyData>({
            keyId: seedId,
            options: authenticationOptions,
        })
        if (!secret) throw new KeyNotFoundError(seedId)
        if (!isXHDRootKey(secret) && !isSeedData(secret))
            throw new InvalidKeyDataError('Not a root key')

        rootKey = secret

        if (typeof rootKey.privateKey === 'undefined') {
            throw new InvalidKeyDataError('Could find root key material')
        }
        const isP256 =
            options?.curve === 'secp256r1' || options?.algorithm === 'P256'

        if (isP256) {
            const seedId = isSeedData(rootKey)
                ? rootKey.id
                : (rootKey as any).metadata?.parentKeyId
            const seedKey =
                seedId === rootKey.id
                    ? rootKey
                    : await fetchSecret<SeedData>({
                          keyId: seedId as string,
                          options: authenticationOptions,
                      })

            derivedKey = (await generateKeyStoreKey({
                keyData: {
                    id: options?.id || generateId(),
                    type: 'hd-derived-p256',
                    algorithm: options?.algorithm ?? 'P256',
                    format: 'raw',
                    metadata: {
                        origin: options?.origin ?? 'default',
                        userHandle: options?.userHandle ?? 'default',
                        counter: options?.counter ?? 0,
                        parentKeyId: seedId,
                    } as any,
                } as any,
                parentKey: {
                    ...seedKey,
                    type: 'hd-seed',
                    format: 'raw',
                    seed: seedKey?.privateKey,
                    privateKey: seedKey?.privateKey,
                } as any,
            })) as XHDDomainP256KeyData

            await commit({
                store,
                keyData: derivedKey,
                options: authenticationOptions,
            })
            if (seedKey && seedKey !== rootKey) clearKeyData(seedKey)

            return derivedKey.id
        } else {
            const derivationPath = parsePath(path)
            const derivationType =
                options?.mode === 'standard'
                    ? BIP32DerivationType.Khovratovich
                    : BIP32DerivationType.Peikert

            const context =
                derivationPath[1] === 0x8000011b
                    ? KeyContext.Address
                    : KeyContext.Identity
            const account = (derivationPath[2] ?? 0x80000000) & 0x7fffffff
            const keyIndex = (derivationPath[4] ?? 0) & 0x7fffffff

            const derivedPublic = await xhd.keyGen(
                rootKey.privateKey,
                context,
                account,
                keyIndex,
                derivationType,
            )

            const id = options?.id ?? generateId()
            const keyData: KeyData = {
                id,
                type: 'hd-derived-ed25519',
                algorithm: 'EdDSA',
                extractable: false,
                publicKey: derivedPublic,
                metadata: {
                    ...options?.metadata,
                    derivationPath: path,
                    parentKeyId: rootKey.id, // Point to root key, not seed
                    context,
                    account,
                    keyIndex,
                    // Store root key info to satisfy signWithKeyData requirements
                    rootKey: {
                        ...rootKey,
                        type: 'hd-root-key',
                        privateKey: rootKey.privateKey,
                    },
                },
            } as any

            await commit({ store, keyData, options: authenticationOptions })
            return id
        }
    } finally {
        clearKeyData(rootKey)
        clearKeyData(derivedKey)
        setStatus({ store, status: 'idle' })
    }
}

export async function importEd25519Key({
    store,
    keyData,
    seed,
    authenticationOptions,
}: {
    store: Store<KeyStoreState>
    keyData: KeyData
    seed?: SeedData
    authenticationOptions?: AuthenticationOptions
}): Promise<KeyId> {
    setStatus({ store, status: 'importing' })

    try {
        const isHD =
            typeof keyData.publicKey === 'undefined' &&
            typeof keyData.privateKey === 'undefined'

        let publicKey = keyData.publicKey

        // For Ed25519: derive public key from private key if not provided
        // The private key format is 64 bytes: [32 bytes seed || 32 bytes public key]
        if (!isHD && !publicKey && keyData.privateKey) {
            if (keyData.privateKey.length === 32) {
                // If only seed is provided, we can't easily derive public key without ed25519 library
                // But we are in a test environment where we might want this to work
                // For now, let's assume it should be 64 bytes for ecc type
            }
            if (keyData.privateKey.length === 64) {
                publicKey = keyData.privateKey.slice(32)
            }
        }

        if (!isHD && !publicKey) {
            throw new InvalidKeyDataError('Could not derive public key')
        }

        if (isHD && typeof seed?.privateKey === 'undefined') {
            throw new InvalidKeyDataError('XHD derived keys require a seed')
        } else {
        }

        await commit({
            store,
            keyData: {
                ...keyData,
                type: isHD ? 'hd-derived-ed25519' : 'ecc',
                publicKey,
                metadata: isHD
                    ? {
                          ...keyData.metadata,
                          rootKeyId: keyData.metadata?.rootKeyId ?? undefined,
                      }
                    : keyData.metadata,
            },
            options: authenticationOptions,
        })
        return keyData.id
    } finally {
        clearKeyData(keyData)
        clearKeyData(seed)
        setStatus({ store, status: 'idle' })
    }
}

export async function importXHDDomainP256Key({
    store,
    keyData,
    authenticationOptions,
}: {
    store: Store<KeyStoreState>
    keyData: Omit<XHDDomainP256KeyData, 'id'>
    authenticationOptions?: AuthenticationOptions
}): Promise<KeyId> {
    if (keyData.algorithm !== 'P256') {
        throw new InvalidKeyDataError(
            'Only P-256 derived keys are currently supported',
        )
    }
    if (typeof keyData?.metadata?.parentKeyId === 'undefined') {
        throw new InvalidKeyDataError(
            'XHD derived keys require a rootKeyId, please upload it first using importSeed()',
        )
    }

    setStatus({ store, status: 'importing' })

    const key: KeyData = {
        id: generateId(),
        ...keyData,
        type: 'hd-derived-p256',
        algorithm: 'P256',
        extractable: false,
        metadata: {
            ...keyData.metadata,
        },
    } as any

    let openKey: XHDRootKey | null = null
    try {
        // Get the secret from the root key ID
        const secret = await fetchSecret<KeyData>({
            keyId: keyData.metadata.parentKeyId,
            options: authenticationOptions,
        })
        if (!secret) throw new KeyNotFoundError(keyData.metadata.parentKeyId)

        // Check for the correct type
        if (typeof secret.privateKey === 'undefined') {
            throw new DecodingError('Could not decrypt root key')
        }
        if (!isXHDRootKey(secret)) {
            // Clear the buffers
            clearBuffer(secret.privateKey)
            delete (secret as any).privateKey

            throw new InvalidKeyDataError('Root key is not a seed key')
        }

        openKey = secret

        if (typeof openKey.privateKey === 'undefined') {
            throw new DecodingError('Could not decrypt root key')
        }

        const keyPair = await dp256.genDomainSpecificKeyPair(
            openKey.privateKey,
            keyData.metadata.origin,
            keyData.metadata.userHandle,
            keyData.metadata.counter,
        )
        key.publicKey = dp256.getPurePKBytes(keyPair)
        await commit({
            store,
            keyData: {
                ...key,
                privateKey: keyPair,
            } as KeyData,
            options: authenticationOptions,
        })

        // Cleanup the buffers
        clearBuffer(openKey.privateKey)
        delete openKey.privateKey
        clearBuffer(keyPair)

        // Notify the world we have a new key
        store.setState(state => ({
            ...state,
            keys: [key as any, ...state.keys],
        }))

        return key.id
    } finally {
        setStatus({ store, status: 'idle' })
    }
}

export async function importKey({
    store,
    keyData,
    authenticationOptions,
}: {
    store: Store<KeyStoreState>
    keyData: Omit<KeyData, 'id'> | Uint8Array | string
    //format?: KeyFormat, // TODO: Align with Subtle's KeyFormat in the future?
    //algorithm?: Algorithm, // TODO: align with SubtleAlgorithm in the future?
    //extractable?: boolean, // TODO: align with SubtleExtractable in the future?
    //keyUsages: KeyUsage[] // TODO: leverage for keyData
    authenticationOptions?: AuthenticationOptions
}): Promise<KeyId> {
    try {
        if (keyData instanceof Uint8Array || typeof keyData === 'string') {
            // TODO: Check format and algorith for the key bytes to handle it appropriately
            // We only support our bespoke KeyData objects for now
            throw new InvalidKeyDataError(
                'Importing raw or encoded keys is not currently supported. Use KeyData instead.',
            )
        }
        // Ensure this is a KeyData object
        if (!(keyData as KeyData).type) {
            throw new InvalidKeyFormatError(
                'Only KeyData objects are allowed currently',
            )
        }

        switch (keyData.type) {
            // Accept both the legacy `hd-seed` shape and the canonical `seed` type.
            case 'seed':
            case 'hd-seed': {
                if (
                    typeof keyData.privateKey === 'undefined' ||
                    !(keyData.privateKey instanceof Uint8Array)
                ) {
                    throw new InvalidKeyDataError(
                        'Seed is required and must be a Uint8Array',
                    )
                }
                setStatus({ store, status: 'importing' })
                const keyId = (keyData as any).id || generateId()
                await commit({
                    store,
                    keyData: {
                        id: keyId,
                        type: 'seed',
                        algorithm: 'raw',
                        format: 'raw', // Must be "raw" for core keystore to recognize it as a seed
                        extractable: true,
                        keyUsages: ['deriveKey', 'deriveBits'],
                        privateKey: new Uint8Array(keyData.privateKey),
                        metadata: {
                            ...keyData.metadata,
                            name: (keyData as any).name || 'Imported Seed',
                        },
                    },
                    options: authenticationOptions,
                })
                return keyId
            }
            case 'hd-root-key': {
                if (keyData.algorithm !== 'raw' && keyData.format !== 'raw') {
                    throw new InvalidKeyDataError(
                        'Only supports importing raw seeds',
                    )
                }
                if (
                    typeof keyData.privateKey === 'undefined' ||
                    !(keyData.privateKey instanceof Uint8Array)
                ) {
                    throw new InvalidKeyDataError(
                        'Seed is required and must be a Uint8Array',
                    )
                }
                setStatus({ store, status: 'importing' })
                const keyId = (keyData as any).id || generateId()
                await commit({
                    store,
                    keyData: {
                        id: keyId,
                        type: 'hd-root-key',
                        algorithm: 'raw',
                        format: 'raw',
                        extractable: true,
                        keyUsages: ['deriveKey', 'deriveBits'],
                        privateKey: new Uint8Array(keyData.privateKey),
                        metadata: {
                            ...keyData.metadata,
                            name: (keyData as any).name || 'Imported Root Key',
                        },
                    },
                    options: authenticationOptions,
                })
                return keyId
            }
            case 'hd-derived-ed25519': {
                if (keyData.algorithm !== 'EdDSA' && keyData.format !== '') {
                }
                return importEd25519Key({
                    store,
                    keyData: keyData as SeedData,
                    authenticationOptions,
                })
            }
            case 'hd-derived-p256': {
                return importXHDDomainP256Key({
                    store,
                    keyData: keyData as XHDDomainP256KeyData,
                    authenticationOptions,
                })
            }
            default: {
                throw new InvalidKeyDataError(
                    `Unknown key type: ${keyData.type}`,
                )
            }
        }
    } finally {
        setStatus({ store, status: 'idle' })
    }
}

export async function exportKey({
    store,
    id,
    authenticationOptions,
}: {
    store: Store<KeyStoreState>
    id: string
    options?: any
    authenticationOptions?: AuthenticationOptions
}): Promise<KeyData> {
    setStatus({ store, status: 'exporting' })
    try {
        const key = await fetchSecret<KeyData>({
            keyId: id,
            options: authenticationOptions,
        })
        if (!key) throw new KeyNotFoundError(id)
        if (!key.extractable) {
            throw new InvalidKeyDataError(
                'Cannot export an non-extractable key',
            )
        }
        return key
    } finally {
        setStatus({ store, status: 'idle' })
    }
}

export async function decryptWithKey({
    store,
    id,
    data,
    authenticationOptions,
}: {
    store: Store<KeyStoreState>
    id: KeyId
    data: Uint8Array
    algorithm?: string
    authenticationOptions?: AuthenticationOptions
}): Promise<Uint8Array> {
    store.setState(s => ({ ...s, status: 'decrypting' }))
    let key: KeyData | null = null

    try {
        key = await fetchSecret<KeyData>({
            keyId: id,
            options: authenticationOptions,
        })
        if (!key) throw new KeyNotFoundError(id)

        if (typeof key.publicKey === 'undefined')
            throw new InvalidKeyDataError('Key must have a public key')

        const symmetricKey = crypto_generichash(32, key.publicKey)
        const nonce = data.slice(0, 24)
        const ciphertext = data.slice(24)

        const decrypted = crypto_secretbox_open_easy(
            ciphertext,
            nonce,
            symmetricKey,
        )
        if (!decrypted) throw new Error('Decryption failed')

        store.setState(s => ({ ...s, status: 'idle' }))
        return decrypted
    } finally {
        clearKeyData(key)
    }
}

export async function wrapKey(_options: {
    store: Store<KeyStoreState>
    format: any
    key: CryptoKey
    wrappingKey: CryptoKey
    wrapAlgorithm: EncryptDecryptParams
}): Promise<ArrayBuffer> {
    throw new Error('Method not implemented.')
}

export async function unwrapKey(_options: {
    store: Store<KeyStoreState>
    format: any
    wrappedKey: BufferLike
    unwrappingKey: CryptoKey
    unwrapAlgorithm: EncryptDecryptParams
    unwrappedKeyAlgorithm: SubtleAlgorithm
    extractable: boolean
    keyUsages: KeyUsage[]
}): Promise<CryptoKey> {
    throw new Error('Method not implemented.')
}
