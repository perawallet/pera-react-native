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
    createKeyHandle,
    InvalidKeyDataError,
    MaterialAccessError,
} from '@algorandfoundation/keystore-core'
import type { Secp256k1Binding } from './binding'
import { parseBip32Path } from './binding'
import { bip39SeedFromEntropy } from './bip39Seed'

export const SECP256K1_ALGORITHM = 'ECDSA-secp256k1'

const DIGEST_LENGTH = 32

type Secp256k1Params = {
    name: string
    entropy?: BufferSource
    path?: string
    privateKey?: BufferSource
}

const algorithmNameOf = (algorithm: AlgorithmIdentifier): string =>
    typeof algorithm === 'string' ? algorithm : algorithm.name

// A view over the caller's buffer, not a copy: zeroing it wipes what the engine
// injected, as keystore-core's own shims do.
const bytesOf = (source: BufferSource): Uint8Array =>
    ArrayBuffer.isView(source)
        ? new Uint8Array(source.buffer, source.byteOffset, source.byteLength)
        : new Uint8Array(source)

const paramBytes = (
    algorithm: AlgorithmIdentifier,
    field: 'entropy' | 'privateKey',
): Uint8Array => {
    const source = (algorithm as Secp256k1Params)[field]
    if (source === undefined) {
        throw new MaterialAccessError(
            `algorithm parameter "${field}" is required and must be supplied per-operation`,
        )
    }
    return bytesOf(source)
}

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
    bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer

// keystore-core composes shims through a Proxy that binds the host's methods;
// its helper isn't exported, so this mirrors it.
const extendHost = (
    host: SubtleCrypto,
    overrides: Partial<SubtleCrypto>,
): SubtleCrypto =>
    new Proxy(host, {
        get(target, property) {
            if (Object.prototype.hasOwnProperty.call(overrides, property)) {
                return (overrides as Record<string | symbol, unknown>)[property]
            }
            const value = Reflect.get(target, property, target)
            return typeof value === 'function' ? value.bind(target) : value
        },
    })

/**
 * Adds secp256k1 to a host Subtle. Private material only ever arrives through
 * an operation's parameters and is zeroed once used; nothing is exportable.
 *
 * - `generateKey({ entropy, path })` derives the BIP-32 child of a BIP-39 seed
 *   and hands its material to the engine on the returned handles.
 * - `deriveBits({ privateKey })` returns the 65-byte public key.
 * - `sign({ privateKey }, …, digest)` signs a 32-byte digest as `r‖s‖yParity`.
 */
export const withSubtleSecp256k1 = (
    host: SubtleCrypto,
    binding: Secp256k1Binding,
): SubtleCrypto => {
    const generateKey = (async (
        algorithm: AlgorithmIdentifier,
        extractable: boolean,
        keyUsages: KeyUsage[],
    ) => {
        if (algorithmNameOf(algorithm) !== SECP256K1_ALGORITHM) {
            return host.generateKey(
                algorithm as AlgorithmIdentifier & RsaHashedKeyGenParams,
                extractable,
                keyUsages,
            )
        }
        const entropy = paramBytes(algorithm, 'entropy')
        let seed: Uint8Array | undefined
        try {
            const path = (algorithm as Secp256k1Params).path
            if (typeof path !== 'string') {
                throw new InvalidKeyDataError(
                    'secp256k1 generateKey requires a path',
                )
            }
            parseBip32Path(path)
            seed = await bip39SeedFromEntropy(host, entropy)
            const privateKey = binding.deriveChildPrivateKey(seed, path)
            const publicKey = binding.publicKeyOf(privateKey)
            const keyAlgorithm = { name: SECP256K1_ALGORITHM }
            return {
                publicKey: createKeyHandle(
                    'public',
                    keyAlgorithm,
                    true,
                    keyUsages.filter(usage => usage === 'verify'),
                    publicKey,
                ),
                privateKey: createKeyHandle(
                    'private',
                    keyAlgorithm,
                    extractable,
                    keyUsages.filter(usage => usage === 'sign'),
                    privateKey,
                ),
            }
        } finally {
            entropy.fill(0)
            seed?.fill(0)
        }
    }) as SubtleCrypto['generateKey']

    const deriveBits: SubtleCrypto['deriveBits'] = async (
        algorithm,
        baseKey,
        length,
    ) => {
        if (algorithmNameOf(algorithm) !== SECP256K1_ALGORITHM) {
            return host.deriveBits(algorithm, baseKey, length)
        }
        const privateKey = paramBytes(algorithm, 'privateKey')
        try {
            if (!binding.isValidPrivateKey(privateKey)) {
                throw new InvalidKeyDataError('invalid secp256k1 private key')
            }
            return toArrayBuffer(binding.publicKeyOf(privateKey))
        } finally {
            privateKey.fill(0)
        }
    }

    const sign: SubtleCrypto['sign'] = async (algorithm, key, data) => {
        if (algorithmNameOf(algorithm) !== SECP256K1_ALGORITHM) {
            return host.sign(algorithm, key, data)
        }
        const privateKey = paramBytes(algorithm, 'privateKey')
        try {
            const digest = bytesOf(data)
            if (digest.length !== DIGEST_LENGTH) {
                throw new InvalidKeyDataError(
                    `secp256k1 signs a ${DIGEST_LENGTH}-byte digest, got ${digest.length}`,
                )
            }
            return toArrayBuffer(binding.signDigest(privateKey, digest))
        } finally {
            privateKey.fill(0)
        }
    }

    const importKey = (async (
        ...args: Parameters<SubtleCrypto['importKey']>
    ) => {
        if (algorithmNameOf(args[2]) !== SECP256K1_ALGORITHM) {
            return (host.importKey as (...a: unknown[]) => Promise<CryptoKey>)(
                ...args,
            )
        }
        throw new MaterialAccessError(
            'secp256k1 key material is owned by the storage engine; importKey is not supported',
        )
    }) as SubtleCrypto['importKey']

    const exportKey = (async (format: KeyFormat, key: CryptoKey) => {
        if (key.algorithm.name !== SECP256K1_ALGORITHM) {
            return host.exportKey(format as 'raw', key)
        }
        throw new MaterialAccessError(
            'secp256k1 key material never leaves the storage engine; exportKey is not supported',
        )
    }) as SubtleCrypto['exportKey']

    return extendHost(host, {
        generateKey,
        deriveBits,
        sign,
        importKey,
        exportKey,
    })
}
