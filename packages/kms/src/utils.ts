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

import type { Key } from '@algorandfoundation/keystore-core'
import { encodeAddress } from 'algosdk'
import nacl from 'tweetnacl'
import { AccessControlPermission, type AccessControl } from './models'
import {
    SeedScheme,
    SIGNING_ACCESS_DOMAIN,
    BACKUP_ACCESS_DOMAIN,
} from './constants'
import { KeyManagementError } from './errors'

/**
 * Nested under `metadata.pera` because the keystore reserves top-level metadata
 * keys (`parentKeyId`, `path`, `account`, `scheme`, …) for its own use.
 */
export type SeedPeraMetadata = {
    acl?: AccessControl[]
    createdAt?: string // ISO 8601 — Dates aren't JSON-safe
    expiresAt?: string
}

export type SeedMetadata = {
    scheme?: SeedScheme
    pera?: SeedPeraMetadata
    [key: string]: unknown
}

/**
 * A bip39 seed's entropy is never stored here — it lives in a separate
 * `secret-key` child (see {@link entropyChildMetadata}) so it can't leak
 * through the seed's exported metadata.
 */
export const buildSeedMetadata = (params: {
    scheme: SeedScheme
    acl?: AccessControl[]
    createdAt?: Date
    expiresAt?: Date
}): SeedMetadata => {
    const { scheme, acl, createdAt, expiresAt } = params
    return {
        scheme,
        pera: {
            acl,
            createdAt: (createdAt ?? new Date()).toISOString(),
            expiresAt: expiresAt?.toISOString(),
        },
    }
}

/**
 * Marks the `secret-key` child holding a bip39 seed's entropy. Located by this
 * metadata rather than a derived id format, and stored apart from the seed so it
 * never rides along in the seed's snapshot or exported metadata.
 */
export const entropyChildMetadata = (
    seedKeyId: string,
): { parentKeyId: string; entropyKey: true } => ({
    parentKeyId: seedKeyId,
    entropyKey: true,
})

/**
 * Finds the keystore id of a seed's entropy `secret-key` child by its metadata
 * ({@link entropyChildMetadata}), or `undefined` if it has none.
 *
 * The `secret-key` clause keeps this identical to the two copies that cannot
 * import it — `repairs/0003-mint-passkey-main-key.ts:139-143` (MMKV records,
 * pre-engine) and `keystore-chrome`'s `keystore-signer.ts` — which all three
 * must be, since they pick the same main key's parent. `commitSecret` writes
 * entropy through the secrets API, which stamps `type: 'secret-key'`
 * (`keystore-core@1.0.0-canary.3` `dist/create.js:1180`), so nothing legitimate
 * is excluded.
 */
export const entropyChildIdOf = (
    seedKeyId: string,
    keys: readonly Key[],
): string | undefined =>
    keys.find(k => {
        const meta = (k.metadata ?? {}) as {
            parentKeyId?: unknown
            entropyKey?: unknown
        }
        return (
            k.type === 'secret-key' &&
            meta.parentKeyId === seedKeyId &&
            meta.entropyKey === true
        )
    })?.id

const seedMetadata = (key: Key): SeedMetadata =>
    (key.metadata ?? {}) as SeedMetadata

/**
 * A bip39 wallet's root is stored as `hd-root-key` — canary.14's
 * `deriveFromSeed` rejects any parent that is not typed that way — but it is
 * still the entry that owns the scheme and the recovery material, so it counts
 * as a root here alongside the `seed` types.
 */
const SEED_BEARING_TYPES: ReadonlySet<string> = new Set([
    'seed',
    'hd-seed',
    'hd-root-key',
])

/**
 * `null` for anything that isn't a recognised wallet root — derived children,
 * secret-key entries — which must not be treated as one.
 */
export const seedSchemeOf = (key: Key): SeedScheme | null => {
    if (!SEED_BEARING_TYPES.has(key.type)) return null
    const scheme = seedMetadata(key).scheme
    if (
        scheme === SeedScheme.Bip39 ||
        scheme === SeedScheme.Algo25 ||
        scheme === SeedScheme.Quantum
    ) {
        return scheme
    }
    return null
}

export const isSeedKey = (key: Key): boolean => seedSchemeOf(key) !== null

/**
 * '' when the snapshot carries no `publicKey`, and for bip39 seeds, which have
 * no single address.
 */
export const algo25AddressOf = (key: Key): string => {
    if (seedSchemeOf(key) !== SeedScheme.Algo25) return ''
    if (key.publicKey instanceof Uint8Array) {
        return encodeAddress(new Uint8Array(key.publicKey))
    }
    return ''
}

// The wallet's own access origins, shared with the consumers that pass them to
// `checkAccess` (signing's SIGNING_KEY_DOMAIN, the backup flow's DOMAIN) so the
// fail-closed default and the call sites can't drift.
const DEFAULT_SEED_ACL: AccessControl[] = [
    {
        domains: [SIGNING_ACCESS_DOMAIN, BACKUP_ACCESS_DOMAIN],
        permissions: [AccessControlPermission.ReadPrivate],
    },
]

export const aclOf = (key: Key): AccessControl[] => {
    const stored = seedMetadata(key).pera?.acl
    // Fail closed: a seed with no/empty ACL is treated as scoped to the
    // wallet's own origins, not allow-all. `checkAccess` then denies any other
    // domain instead of silently permitting it. Existing seeds (which all have
    // empty ACLs) keep working because every real caller passes one of the
    // default domains.
    return stored && stored.length > 0 ? stored : DEFAULT_SEED_ACL
}

export const createdAtOf = (key: Key): Date => {
    const iso = seedMetadata(key).pera?.createdAt
    return iso ? new Date(iso) : new Date()
}

export const expiresAtOf = (key: Key): Date | undefined => {
    const iso = seedMetadata(key).pera?.expiresAt
    return iso ? new Date(iso) : undefined
}

export const hexToBytes = (hex: string): Uint8Array => {
    // Reject malformed input up front: an odd length or a non-hex character
    // would otherwise decode silently (`parseInt` yields NaN → 0), producing
    // wrong key/entropy bytes instead of a clear failure.
    if (hex.length % 2 !== 0 || /[^0-9a-fA-F]/.test(hex)) {
        throw new KeyManagementError('hexToBytes: input is not valid hex')
    }
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
