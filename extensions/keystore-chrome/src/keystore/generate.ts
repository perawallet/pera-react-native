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
// Ported from @algorandfoundation/keystore@1.0.0-canary.17 generate.ts
// Portions Copyright Algorand Foundation, Apache-2.0
// oxlint-disable @typescript-eslint/no-explicit-any, unicorn/switch-case-braces -- ported verbatim from @algorandfoundation/keystore@1.0.0-canary.17; upstream style preserved
// node:crypto's `subtle` replaced by the web-standard `crypto.subtle` (see
// extensions/keystore-chrome's existing vault/vault.ts convention — this
// package targets the browser, not Node).

import { clearBuffer, generateId } from '@algorandfoundation/wallet-provider'
import {
    BIP32DerivationType,
    fromSeed,
    KeyContext,
} from '@algorandfoundation/xhd-wallet-api'
import { crypto_sign_keypair } from '@algorandfoundation/xhd-wallet-api/dist/sumo.facade.js'
import * as bip39 from '@scure/bip39'
// catalog pins @scure/bip39@^2.2.0, whose exports map requires the .js suffix
// on wordlist subpaths (unlike canary.17's pinned 1.6.0, which allowed
// extension-less imports).
import { wordlist as englishWordList } from '@scure/bip39/wordlists/english.js'
import { clearKeyData, getBIP44PathFromContext } from './crypto'
import { encodeAddress } from './encoding'
import { InvalidKeyDataError } from './errors'
import { dp256, xhd } from '../libs'
import type {
    Ed25519KeyData,
    Key,
    KeyData,
    Seed,
    SecretKeyData,
    SeedData,
    XHDDerivedKeyData,
    XHDDomainP256KeyData,
    XHDRootKey,
} from './types'

/**
 * Returns true when a key value carries the bytes of a BIP39 seed
 * (regardless of whether it uses the legacy `hd-seed` type or the new `seed`
 * type).
 */
function isSeedLike(key: Partial<KeyData> | null | undefined): key is SeedData {
    return !!key && (key.type === 'seed' || key.type === 'hd-seed')
}

/**
 * Options for BIP39 mnemonic generation.
 */
export interface BIP39GenerationOptions {
    /** Optional ID for the generated key */
    id?: string
    /** Optional name for the generated key */
    name?: string
    /** Strength of the mnemonic (128, 256 bits) */
    strength?: number
    /** Wordlist to use for the mnemonic */
    wordlist?: string[]
    /** Whether the generated key is extractable */
    extractable?: boolean
    /** Optional passphrase for the seed */
    passphrase?: string
}

/**
 * Generates a new seed from a BIP39 mnemonic.
 *
 * @remarks
 * The returned key now uses the canonical `seed` type. The legacy `hd-seed`
 * shape is still recognised by all consumers in this module.
 *
 * @param options - Generation options
 * @returns The generated seed data
 */
export async function generateSeedData(
    options: BIP39GenerationOptions = { strength: 256 },
): Promise<Seed> {
    return {
        id: options.id || generateId(),
        type: 'seed',
        name: options.name || 'Secret Key',
        algorithm: 'raw',
        format: 'bytes',
        extractable: true,
        keyUsages: ['deriveKey', 'deriveBits'],
        privateKey: await bip39.mnemonicToSeed(
            bip39.generateMnemonic(englishWordList, options.strength),
            options.passphrase,
        ),
        metadata: {
            protected: options.passphrase ? true : undefined,
            strength: options.strength,
            language: 'english',
            scheme: 'bip39',
        },
    } as Seed
}

/**
 * Generates a standalone Ed25519 keypair from an existing 32-byte seed
 * (typically the output of {@link generateSeedData} or any other seed source).
 *
 * @example
 * ```typescript
 * const seed = await generateSeedData({ strength: 128 });
 * const key  = await generateEd25519FromSeed(seed);
 * ```
 */
export async function generateEd25519FromSeed(
    seed: SeedData,
    options: { id?: string; name?: string } = {},
): Promise<Ed25519KeyData> {
    if (!isSeedLike(seed) || !(seed.privateKey instanceof Uint8Array)) {
        throw new InvalidKeyDataError('Ed25519 keys require a raw seed')
    }
    const ed25519Seed = seed.privateKey.slice(0, 32)
    try {
        const { publicKey, secretKey } = crypto_sign_keypair(ed25519Seed)
        return {
            id: options.id || generateId(),
            type: 'ed25519',
            name: options.name || 'Ed25519 Key',
            algorithm: 'EdDSA',
            format: 'raw',
            extractable: true,
            keyUsages: ['sign', 'verify'],
            publicKey: new Uint8Array(publicKey),
            privateKey: new Uint8Array(secretKey),
            metadata: {
                parentKeyId: seed.id,
            },
        } as Ed25519KeyData
    } finally {
        clearBuffer(ed25519Seed)
        clearKeyData(seed)
    }
}

/**
 * Options for generating a {@link SecretKeyData} entry.
 */
export interface SecretKeyGenerationOptions {
    /** Optional ID for the generated key. */
    id?: string
    /** Optional name for the generated key. */
    name?: string
    /**
     * The arbitrary text or byte payload to store. If omitted, a random
     * 32-byte value is generated.
     */
    value?: string | Uint8Array
    /** Whether the generated key is extractable (defaults to `true`). */
    extractable?: boolean
    /** Custom metadata to attach to the key. */
    metadata?: Record<string, unknown>
}

/**
 * Generates a {@link SecretKeyData}: an arbitrary, user-provided value with no
 * intrinsic cryptographic purpose. The keystore stores it verbatim so that
 * applications can leverage it however they need.
 *
 * @example
 * ```typescript
 * const apiToken = await generateSecretKey({ value: "my-api-token" });
 * ```
 */
export async function generateSecretKey(
    options: SecretKeyGenerationOptions = {},
): Promise<SecretKeyData> {
    const value =
        typeof options.value === 'string'
            ? new TextEncoder().encode(options.value)
            : options.value instanceof Uint8Array
              ? options.value
              : crypto.getRandomValues(new Uint8Array(32))

    return {
        id: options.id || generateId(),
        type: 'secret-key',
        name: options.name || 'Secret',
        algorithm: 'raw',
        format: 'raw',
        extractable: options.extractable ?? true,
        keyUsages: [],
        privateKey: new Uint8Array(value),
        metadata: { ...options.metadata },
    } as SecretKeyData
}

/**
 * Generates an XHD root key from a seed.
 * @param seed - The seed data to use
 * @returns The generated root key
 */
export async function generateXHDRootKeyFromSeed(
    seed: SeedData,
    options: { id?: string } = {},
): Promise<XHDRootKey> {
    try {
        if (
            !isSeedLike(seed) ||
            typeof seed.privateKey === 'undefined' ||
            !(seed.privateKey instanceof Uint8Array)
        ) {
            throw new InvalidKeyDataError('XHD root keys require a raw seed')
        }
        const id = options.id || generateId()
        return {
            id,
            type: 'hd-root-key',
            algorithm: 'raw',
            format: 'bytes',
            extractable: true,
            keyUsages: ['deriveKey', 'deriveBits'],
            // TODO: fix parameters in XHD fromSeed
            privateKey: fromSeed(new Uint8Array(seed.privateKey) as any),
            metadata: {
                // `parentKeyId` is the canonical link from a derived key to its
                // parent across the keystore. We keep `rootKeyId` for backwards
                // compatibility with existing consumers that look it up directly.
                parentKeyId: seed.id,
                rootKeyId: seed.id,
            },
        } as XHDRootKey
    } finally {
        clearKeyData(seed)
    }
}

/**
 * Generates a derived key or P256 key from a parent root key.
 * @param params - The generation parameters
 * @param params.key - Partial key data for the derived key
 * @param params.parentKey - The parent root key
 * @returns The fully populated derived key or P256 key
 */
export async function generateXHDFromParent({
    key,
    parentKey,
}: {
    key: Partial<XHDDerivedKeyData> | Partial<XHDDomainP256KeyData>
    parentKey: XHDRootKey
}): Promise<XHDDerivedKeyData | XHDDomainP256KeyData> {
    const id = key.id || generateId()

    let pk: Uint8Array<ArrayBufferLike> | undefined
    try {
        switch (key.type) {
            case 'hd-derived-ed25519': {
                if (
                    typeof parentKey.privateKey === 'undefined' ||
                    !(parentKey.privateKey instanceof Uint8Array) ||
                    parentKey.type !== 'hd-root-key'
                ) {
                    throw new InvalidKeyDataError(
                        'XHD derived keys require a raw hd-root-key',
                    )
                }

                const metadata = key.metadata
                    ? {
                          path:
                              key.metadata.path ??
                              getBIP44PathFromContext(
                                  key.metadata?.context ?? KeyContext.Address,
                                  key.metadata?.account ?? 0,
                                  key.metadata?.index ?? 0,
                              ),
                          context: key.metadata.context ?? KeyContext.Address,
                          account: key.metadata.account ?? 0,
                          index: key.metadata.index ?? 0,
                          derivation:
                              key.metadata.derivation ??
                              BIP32DerivationType.Peikert,
                      }
                    : {
                          path: getBIP44PathFromContext(
                              KeyContext.Address,
                              0,
                              0,
                          ),
                          context: KeyContext.Address,
                          account: 0,
                          index: 0,
                          derivation: BIP32DerivationType.Peikert,
                      }

                pk = await xhd.keyGen(
                    parentKey.privateKey,
                    metadata.context ?? KeyContext.Address,
                    metadata.account ?? 0,
                    metadata.index ?? 0,
                    metadata.derivation ?? BIP32DerivationType.Peikert,
                )
                return {
                    ...key,
                    id,
                    algorithm: 'EdDSA',
                    format: 'bytes',
                    extractable: true,
                    publicKey: new Uint8Array(pk),
                    metadata: {
                        ...metadata,
                        address: {
                            algorand: encodeAddress(pk),
                        },
                        parentKeyId: parentKey.id,
                    },
                } as XHDDerivedKeyData
            }
            case 'hd-derived-p256': {
                if (
                    typeof parentKey.privateKey === 'undefined' ||
                    !(parentKey.privateKey instanceof Uint8Array) ||
                    parentKey.type !== 'hd-root-key'
                ) {
                    throw new InvalidKeyDataError(
                        'XHD derived keys require a raw hd-root-key',
                    )
                }

                const metadata = key.metadata
                    ? {
                          ...key.metadata,
                          origin: key.metadata.origin ?? 'default',
                          userHandle: key.metadata.userHandle ?? 'default',
                          counter: key.metadata.counter ?? 0,
                      }
                    : {
                          origin: 'default',
                          userHandle: 'default',
                          counter: 0,
                      }

                pk = await dp256.genDomainSpecificKeyPair(
                    parentKey.privateKey,
                    metadata.origin,
                    // Normalize the userHandle
                    metadata.userHandle.toLowerCase(),
                    metadata.counter,
                )
                return {
                    ...key,
                    id,
                    algorithm: 'P256',
                    format: 'bytes',
                    extractable: true,
                    publicKey: dp256.getPurePKBytes(pk),
                    privateKey: new Uint8Array(pk),
                    metadata: {
                        ...metadata,
                        parentKeyId: parentKey.id,
                    },
                } as XHDDomainP256KeyData
            }
            default:
                throw new InvalidKeyDataError('Invalid key type')
        }
    } finally {
        clearKeyData(key)
        clearKeyData(parentKey)
        clearBuffer(pk)
    }
}

export async function generateKey({
    keyData,
    parentKey,
}: {
    keyData: Partial<Key>
    parentKey?: XHDRootKey | SeedData | null
}): Promise<KeyData> {
    const id =
        keyData.id || (keyData.metadata?.params as any)?.id || generateId()

    if (typeof keyData.metadata === 'undefined') {
        throw new InvalidKeyDataError('Key metadata is required')
    }
    try {
        switch (keyData.algorithm) {
            case 'raw': {
                switch (keyData.type) {
                    case 'seed':
                    case 'hd-seed': {
                        return {
                            ...keyData,
                            ...(await generateSeedData(
                                keyData.metadata
                                    .params as BIP39GenerationOptions,
                            )),
                            id,
                        } as Seed
                    }
                    case 'secret-key': {
                        return {
                            ...keyData,
                            ...(await generateSecretKey(
                                keyData.metadata
                                    .params as SecretKeyGenerationOptions,
                            )),
                            id,
                        } as SecretKeyData
                    }
                    case 'hd-root-key': {
                        if (
                            typeof keyData.metadata.parentKeyId === 'undefined'
                        ) {
                            throw new InvalidKeyDataError(
                                'XHD derived keys require a rootKeyId, please upload it first using importSeed()',
                            )
                        }
                        if (
                            !parentKey ||
                            !(parentKey?.privateKey instanceof Uint8Array)
                        )
                            throw new InvalidKeyDataError(
                                'Seed is required to generate root key and must be a Uint8Array',
                            )
                        const generatedRoot = await generateXHDRootKeyFromSeed(
                            parentKey as SeedData,
                            {
                                id,
                            },
                        )
                        return {
                            ...keyData,
                            ...generatedRoot,
                            // Merge metadata so caller-supplied fields (e.g. `createdAt`,
                            // user `parentKeyId`) are preserved alongside the canonical
                            // links produced by `generateXHDRootKeyFromSeed`.
                            metadata: {
                                ...keyData.metadata,
                                ...generatedRoot.metadata,
                            },
                            id,
                        } as XHDRootKey
                    }
                    default: {
                        throw new InvalidKeyDataError(
                            `Unknown key type: ${keyData.type}`,
                        )
                    }
                }
            }
            case 'EdDSA': {
                // Standalone Ed25519 keys must be derived from a `seed`/`hd-seed`
                // parent (which carries raw BIP39 seed bytes). Callers that have a
                // mnemonic should pre-compute the seed via `bip39.mnemonicToSeed`
                // and pass the resulting `SeedData` as the parent.
                if (keyData.type === 'ed25519') {
                    if (!parentKey || !isSeedLike(parentKey)) {
                        throw new InvalidKeyDataError(
                            'ed25519 keys require a seed parent; convert any mnemonic to a seed first',
                        )
                    }
                    return {
                        ...keyData,
                        ...(await generateEd25519FromSeed(
                            parentKey as SeedData,
                            { id },
                        )),
                        id,
                    } as Ed25519KeyData
                }

                if (typeof keyData.metadata.parentKeyId === 'undefined') {
                    throw new InvalidKeyDataError(
                        'XHD derived keys require a rootKeyId, please upload it first using importSeed()',
                    )
                }
                if (
                    !parentKey ||
                    !(parentKey?.privateKey instanceof Uint8Array)
                )
                    throw new InvalidKeyDataError(
                        'Seed is required to generate root key',
                    )
                keyData.type = 'hd-derived-ed25519'
                return {
                    ...keyData,
                    ...(await generateXHDFromParent({
                        key: keyData as XHDDerivedKeyData,
                        parentKey: parentKey as XHDRootKey,
                    })),
                    id,
                } as XHDDerivedKeyData
            }

            case 'P256': {
                if (typeof keyData.metadata.parentKeyId === 'undefined') {
                    throw new InvalidKeyDataError(
                        'P256 require a rootKeyId, please upload it first using importSeed()',
                    )
                }
                if (
                    !(
                        parentKey &&
                        parentKey.type === 'hd-root-key' &&
                        parentKey.privateKey instanceof Uint8Array
                    )
                )
                    throw new InvalidKeyDataError(
                        'Seed is required to generate P256 key',
                    )

                keyData.type = 'hd-derived-p256'
                return {
                    ...keyData,
                    ...(await generateXHDFromParent({
                        key: { ...keyData, id } as XHDDomainP256KeyData,
                        parentKey: parentKey as XHDRootKey,
                    })),
                    id,
                } as XHDDomainP256KeyData
            }
            default: {
                // Fallback: hand off to WebCrypto's SubtleCrypto for any algorithm we
                // do not natively support yet. This lets callers generate
                // standard keys (RSA, ECDSA, AES-GCM, HMAC, ...) by simply naming
                // them via `keyData.algorithm`.
                return await generateWithSubtle(keyData, id)
            }
        }
    } finally {
        clearKeyData(keyData)
        clearKeyData(parentKey)
    }
}

/**
 * Generates a key using the platform's WebCrypto {@link SubtleCrypto}
 * implementation as a fallback for algorithms not natively handled by the
 * keystore. The resulting {@link KeyData} contains raw / PKCS8 / SPKI bytes
 * extracted via `subtle.exportKey` when the algorithm allows it.
 *
 * @example
 * ```typescript
 * const key = await generateKey({
 *   keyData: {
 *     type: "ecc",
 *     algorithm: "ECDSA",
 *     extractable: true,
 *     metadata: { params: { namedCurve: "P-384" } },
 *   },
 * });
 * ```
 */
async function generateWithSubtle(
    keyData: Partial<Key>,
    id: string,
): Promise<KeyData> {
    const params = (keyData.metadata?.params ?? {}) as Record<string, any>
    const algorithm: any = { name: keyData.algorithm, ...params }
    const usages: KeyUsage[] = (keyData.keyUsages ?? [
        'sign',
        'verify',
    ]) as KeyUsage[]
    const extractable = keyData.extractable ?? true

    let cryptoKey: CryptoKey | CryptoKeyPair
    try {
        cryptoKey = (await crypto.subtle.generateKey(
            algorithm,
            extractable,
            usages,
        )) as CryptoKey | CryptoKeyPair
    } catch (error) {
        throw new InvalidKeyDataError(
            `Unsupported algorithm for WebCrypto fallback: ${keyData.algorithm}`,
            error as Error,
        )
    }

    const isPair = (k: CryptoKey | CryptoKeyPair): k is CryptoKeyPair =>
        'privateKey' in (k as CryptoKeyPair)

    const exportRaw = async (
        k: CryptoKey,
        format: 'raw' | 'pkcs8' | 'spki',
    ) => {
        if (!k.extractable) return undefined
        try {
            return new Uint8Array(await crypto.subtle.exportKey(format, k))
        } catch {
            return undefined
        }
    }

    let publicKey: Uint8Array | undefined
    let privateKey: Uint8Array | undefined

    if (isPair(cryptoKey)) {
        publicKey = await exportRaw(cryptoKey.publicKey, 'spki')
        privateKey = await exportRaw(cryptoKey.privateKey, 'pkcs8')
    } else {
        privateKey = await exportRaw(cryptoKey, 'raw')
    }

    return {
        ...keyData,
        id,
        type: keyData.type ?? 'subtle',
        algorithm: keyData.algorithm as any,
        format: isPair(cryptoKey) ? 'der' : 'raw',
        extractable,
        keyUsages: usages,
        publicKey,
        privateKey,
        metadata: { ...keyData.metadata, subtle: true },
    } as KeyData
}
