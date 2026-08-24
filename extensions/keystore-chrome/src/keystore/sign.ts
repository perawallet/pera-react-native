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
// Ported from @algorandfoundation/keystore@1.0.0-canary.17 sign.ts
// Portions Copyright Algorand Foundation, Apache-2.0
//
// One deliberate behavioural deviation from canary.17, marked at its site in
// `signXHDDomainP256KeyData`: the re-derived P-256 domain scalar is zeroed
// after signing. Upstream leaks it. Everything else here is verbatim.
// oxlint-disable -eslint/no-explicit-any, unicorn/switch-case-braces -- ported verbatim from @algorandfoundation/keystore@1.0.0-canary.17; upstream style preserved
// node:crypto's `subtle` replaced by the web-standard `crypto.subtle` (see
// extensions/keystore-chrome's existing vault/vault.ts convention — this
// package targets the browser, not Node).

import { clearKeyData, getBIP44PathFromContext } from './crypto'
import { InvalidKeyDataError } from './errors'
import { dp256, xhd } from '../libs'
import type {
    KeyData,
    XHDDerivedKeyData,
    XHDDomainP256KeyData,
    XHDRootKey,
} from './types'

/**
 * Maps a high-level keystore algorithm name to a WebCrypto
 * `AlgorithmIdentifier`/`SignAlgorithm` shape suitable for
 * `subtle.importKey` and `subtle.sign`.
 */
function toSubtleAlgorithm(algorithm: string): {
    importAlg: any
    signAlg: any
} {
    switch (algorithm) {
        case 'EdDSA':
        case 'Ed25519':
            return {
                importAlg: { name: 'Ed25519' },
                signAlg: { name: 'Ed25519' },
            }
        case 'RS256':
            return {
                importAlg: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
                signAlg: { name: 'RSASSA-PKCS1-v1_5' },
            }
        case 'ES256':
        case 'P256':
        case 'P-256':
            return {
                importAlg: { name: 'ECDSA', namedCurve: 'P-256' },
                signAlg: { name: 'ECDSA', hash: 'SHA-256' },
            }
        case 'HMAC':
            return {
                importAlg: { name: 'HMAC', hash: 'SHA-256' },
                signAlg: { name: 'HMAC' },
            }
        default:
            return {
                importAlg: { name: algorithm },
                signAlg: { name: algorithm },
            }
    }
}

/**
 * Falls back to WebCrypto's {@link SubtleCrypto} to sign data using a key
 * whose algorithm is not natively handled by the keystore. Supports keys
 * stored as raw Ed25519 seeds (32 bytes) or as PKCS8/raw byte buffers.
 *
 * @example
 * ```typescript
 * const sig = await signWithSubtle({ key, data });
 * ```
 */
export async function signWithSubtle({
    key,
    data,
}: {
    key: KeyData
    data: Uint8Array<ArrayBufferLike>
}): Promise<Uint8Array<ArrayBufferLike>> {
    if (!(key.privateKey instanceof Uint8Array)) {
        throw new InvalidKeyDataError('Key does not have a private key')
    }

    const { importAlg, signAlg } = toSubtleAlgorithm(key.algorithm)

    let importFormat: 'raw' | 'pkcs8' =
        key.format === 'der' || key.format === 'pkcs8' ? 'pkcs8' : 'raw'
    let bytes: Uint8Array = key.privateKey

    // Standalone Ed25519 keys carry a 32-byte seed (or a 64-byte
    // libsodium-style seed||public concatenation). WebCrypto's "raw"
    // import uses the public key, so we must wrap the seed in PKCS8 to
    // import the *private* key.
    if (importAlg.name === 'Ed25519') {
        const seed =
            key.privateKey.length === 64
                ? key.privateKey.subarray(0, 32)
                : key.privateKey
        if (seed.length !== 32) {
            throw new InvalidKeyDataError(
                `Ed25519 private key must be 32 bytes (got ${seed.length})`,
            )
        }
        // PKCS8 prefix for an Ed25519 private key wrapping a 32-byte seed.
        const prefix = new Uint8Array([
            0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65,
            0x70, 0x04, 0x22, 0x04, 0x20,
        ])
        bytes = new Uint8Array(prefix.length + seed.length)
        bytes.set(prefix, 0)
        bytes.set(seed, prefix.length)
        importFormat = 'pkcs8'
    }

    let cryptoKey: CryptoKey
    try {
        cryptoKey = (await crypto.subtle.importKey(
            importFormat,
            new Uint8Array(bytes) as any,
            importAlg,
            false,
            ['sign'] as KeyUsage[],
        )) as CryptoKey
    } catch (error) {
        throw new InvalidKeyDataError(
            `WebCrypto sign fallback failed to import key for ${key.algorithm}`,
            error as Error,
        )
    }

    const sig = await crypto.subtle.sign(
        signAlg,
        cryptoKey,
        new Uint8Array(data),
    )
    return new Uint8Array(sig)
}

export async function signXHDDomainP256KeyData({
    key,
    root,
    data,
}: {
    key: XHDDomainP256KeyData
    root: XHDRootKey
    data: Uint8Array
}): Promise<Uint8Array<ArrayBufferLike>> {
    if (key.metadata?.passphraseId) {
        throw new InvalidKeyDataError(
            'Passphrase protected keys are not supported',
        )
    }

    if (key.type !== 'hd-derived-p256') {
        throw new InvalidKeyDataError('Key is not a P256 key')
    }

    if (
        root.type !== 'hd-root-key' ||
        typeof root.privateKey === 'undefined' ||
        !(root.privateKey instanceof Uint8Array)
    ) {
        throw new InvalidKeyDataError('Root key is not a seed key')
    }

    try {
        // DELIBERATE DEVIATION FROM canary.17 (see this file's port header):
        // upstream passes the re-derived domain scalar inline and never wipes
        // it. It is private key material, so it is hoisted here and zeroed in a
        // `finally` — matching this port's own `generate.ts` (`clearBuffer(pk)`)
        // and keystore-core@1.0.0-canary.3's dp256 shim (`scalar.fill(0)`).
        const scalar = await dp256.genDomainSpecificKeyPair(
            root.privateKey,
            key.metadata.origin,
            key.metadata.userHandle,
            key.metadata.counter,
        )
        try {
            return dp256.signWithDomainSpecificKeyPair(scalar, data)
        } finally {
            scalar.fill(0)
        }
    } finally {
        clearKeyData(key)
        clearKeyData(root)
    }
}

export async function signXHDEd25519({
    key,
    root,
    data,
}: {
    key: XHDDerivedKeyData
    root: XHDRootKey
    data: Uint8Array
}): Promise<Uint8Array<ArrayBufferLike>> {
    if (key.type !== 'hd-derived-ed25519') {
        throw new InvalidKeyDataError('Key is not an Ed25519 key')
    }
    if (
        typeof key.metadata === 'undefined' ||
        typeof key.metadata?.parentKeyId === 'undefined'
    ) {
        throw new InvalidKeyDataError('Key does not have a private key')
    }
    if (
        root.type !== 'hd-root-key' ||
        typeof root.privateKey === 'undefined' ||
        !(root.privateKey instanceof Uint8Array)
    ) {
        throw new InvalidKeyDataError('Root key is not available')
    }

    if (key.metadata.parentKeyId !== root.id) {
        throw new InvalidKeyDataError('Root key does not match key ID')
    }

    try {
        const bip44Path: number[] = getBIP44PathFromContext(
            key.metadata.context,
            key.metadata.account,
            key.metadata.index,
        )
        //@ts-expect-error, we are accessing a private field to reduce complexity
        return await xhd.rawSign(
            root.privateKey,
            bip44Path,
            data,
            key.metadata.derivation,
        )
    } finally {
        clearKeyData(key)
        clearKeyData(root)
    }
}

/**
 * Signs data using the provided key data and optional parent key for HD derivation.
 *
 * @param params - The signing parameters.
 * @param params.key - The {@link KeyData} containing the private key.
 * @param params.data - The data to sign.
 * @param params.parentKey - Optional parent {@link KeyData} for HD derivation.
 * @returns A promise that resolves to the signature.
 */
export async function signWithKeyData({
    key,
    data,
    parentKey,
}: {
    key: KeyData
    data: Uint8Array<ArrayBufferLike>
    parentKey?: KeyData
}): Promise<Uint8Array<ArrayBufferLike>> {
    try {
        switch (key.type) {
            case 'hd-derived-ed25519': {
                if (typeof key.metadata?.parentKeyId === 'undefined') {
                    throw new InvalidKeyDataError(
                        'Ed25519 key does not have a parent key ID',
                    )
                }
                if (typeof parentKey === 'undefined') {
                    throw new InvalidKeyDataError(
                        'Ed25519 key does not have a parent key',
                    )
                }
                if (key.metadata.parentKeyId !== parentKey.id) {
                    throw new InvalidKeyDataError(
                        'Parent key does not match root key ID',
                    )
                }
                return signXHDEd25519({
                    key: key as XHDDerivedKeyData,
                    root: parentKey as XHDRootKey,
                    data,
                })
            }
            case 'hd-derived-p256': {
                if (typeof key.metadata?.parentKeyId === 'undefined') {
                    throw new InvalidKeyDataError(
                        'P256 key does not have a parent key ID',
                    )
                }
                if (typeof parentKey === 'undefined') {
                    throw new InvalidKeyDataError(
                        'P256 key does not have a parent key',
                    )
                }
                if (key.metadata.parentKeyId !== parentKey.id) {
                    throw new InvalidKeyDataError(
                        'Parent key does not match root key ID',
                    )
                }
                return signXHDDomainP256KeyData({
                    key: key as XHDDomainP256KeyData,
                    root: parentKey as XHDRootKey,
                    data,
                })
            }
            case 'secret-key': {
                throw new InvalidKeyDataError(
                    'secret-key entries are arbitrary user data and cannot be used to sign',
                )
            }
            default: {
                // Fallback: hand the key off to WebCrypto's SubtleCrypto. This
                // handles standalone Ed25519 keys (generated from a seed phrase),
                // as well as RSA / ECDSA / HMAC keys produced via the WebCrypto
                // generation fallback.
                return signWithSubtle({ key, data })
            }
        }
    } finally {
        clearKeyData(key)
        clearKeyData(parentKey)
    }
}
