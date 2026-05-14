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
import { encodeAddress } from '@algorandfoundation/algokit-utils'
import nacl from 'tweetnacl'
import type { AccessControl } from './models'
import { SeedScheme } from './constants'

/**
 * Pera-domain extras (acl, timestamps) round-trip through a seed entry's
 * `metadata.pera`. The keystore reserves top-level metadata keys for its
 * own use (`parentKeyId`, `path`, `account`, `scheme`, etc.), so we keep
 * Pera-specific fields in a sub-object.
 */
export type SeedPeraMetadata = {
    acl?: AccessControl[]
    createdAt?: string // ISO 8601 — Dates aren't JSON-safe
    expiresAt?: string
}

export type SeedMetadata = {
    scheme?: SeedScheme
    /** Hex-encoded BIP39 entropy. Only present when scheme === 'bip39'. */
    entropy?: string
    pera?: SeedPeraMetadata
    [key: string]: unknown
}

/**
 * Builds the metadata payload for `keyStore.import({ type: 'seed', ... })`.
 * Caller supplies the scheme and (for bip39) the entropy bytes; Pera-domain
 * extras are nested under `pera` so they don't collide with keystore-defined
 * fields.
 */
export const buildSeedMetadata = (params: {
    scheme: SeedScheme
    entropy?: Uint8Array
    acl?: AccessControl[]
    createdAt?: Date
    expiresAt?: Date
}): SeedMetadata => {
    const { scheme, entropy, acl, createdAt, expiresAt } = params
    return {
        scheme,
        ...(entropy ? { entropy: bytesToHex(entropy) } : {}),
        pera: {
            acl,
            createdAt: (createdAt ?? new Date()).toISOString(),
            expiresAt: expiresAt?.toISOString(),
        },
    }
}

const seedMetadata = (key: Key): SeedMetadata =>
    (key.metadata ?? {}) as SeedMetadata

/**
 * Returns the seed scheme of a key, or `null` if the key isn't a recognised
 * wallet-root seed. Use this for type dispatch on signing/mnemonic flows;
 * derived ed25519/hd-derived-ed25519 children, secret-key entries, etc.
 * return null and should not be treated as wallet roots.
 */
export const seedSchemeOf = (key: Key): SeedScheme | null => {
    if (key.type !== 'seed' && key.type !== 'hd-seed') return null
    const scheme = seedMetadata(key).scheme
    if (scheme === SeedScheme.Bip39 || scheme === SeedScheme.Algo25) {
        return scheme
    }
    return null
}

export const isSeedKey = (key: Key): boolean => seedSchemeOf(key) !== null

/**
 * Encoded Algorand address for an Algo25 seed entry. The seed's reactive
 * Key snapshot may carry the Ed25519 public key on `publicKey` (we set it
 * at commit time via the derived ed25519 child); when absent, returns ''.
 * For bip39 seeds there is no single address — returns ''.
 */
export const algo25AddressOf = (key: Key): string => {
    if (seedSchemeOf(key) !== SeedScheme.Algo25) return ''
    if (key.publicKey instanceof Uint8Array) {
        return encodeAddress(new Uint8Array(key.publicKey))
    }
    return ''
}

export const aclOf = (key: Key): AccessControl[] =>
    seedMetadata(key).pera?.acl ?? []

export const createdAtOf = (key: Key): Date => {
    const iso = seedMetadata(key).pera?.createdAt
    return iso ? new Date(iso) : new Date()
}

export const expiresAtOf = (key: Key): Date | undefined => {
    const iso = seedMetadata(key).pera?.expiresAt
    return iso ? new Date(iso) : undefined
}

const HEX_LOOKUP = '0123456789abcdef'

const bytesToHex = (bytes: Uint8Array): string => {
    let out = ''
    for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i]
        out += HEX_LOOKUP[(b >> 4) & 0xf] + HEX_LOOKUP[b & 0xf]
    }
    return out
}

export const hexToBytes = (hex: string): Uint8Array => {
    const out = new Uint8Array(hex.length / 2)
    for (let i = 0; i < out.length; i++) {
        out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    }
    return out
}

/**
 * Computes the Algorand address (encoded) for a freshly-minted Algo25 seed
 * without persisting an intermediate ed25519 key. Used by `useAlgo25` so
 * the caller has the address available before the derived signing key is
 * committed to the keystore.
 */
export const algo25SeedToAddress = (seed: Uint8Array): string => {
    const naclKeyPair = nacl.sign.keyPair.fromSeed(seed)
    return encodeAddress(naclKeyPair.publicKey)
}
