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
import { KeyType, type AccessControl, type KeyPair } from './models'
import { ALGO25_KEYSTORE_TYPE } from './constants'

export const makeKeyPair = (source: Partial<KeyPair>): KeyPair => {
    return {
        id: source.id ?? '',
        keystoreKeyId: source.keystoreKeyId,
        publicKey: source.publicKey ?? '',
        type: source.type ?? 'unknown',
        createdAt: source.createdAt ?? new Date(),
        expiresAt: source.expiresAt,
        acl: source.acl ?? [],
    }
}

// Pera-domain extras (acl, timestamps) round-trip through the keystore Key's
// `metadata` field under this namespace so they don't collide with
// keystore-defined fields like `parentKeyId`, `path`, `account`, `index`.
const PERA_META_KEY = 'pera'

/**
 * Wallet-domain discriminator stamped into `pera.kind` on every wallet-root
 * keystore entry. This is the canonical source of truth for what kind of
 * key an entry represents — the keystore's own `type` field can be
 * ambiguous (Algo25 roots sometimes persist as `hd-seed`), so we don't
 * trust it for classification.
 */
export const PeraKeyKind = {
    HDWalletRoot: 'hd-wallet-root',
    Algo25Root: 'algo25-root',
    DeterministicP256Root: 'deterministic-p256-root',
} as const

export type PeraKeyKind = (typeof PeraKeyKind)[keyof typeof PeraKeyKind]

type PeraMetadata = {
    acl?: AccessControl[]
    createdAt?: string // ISO 8601 — Dates aren't JSON-safe
    expiresAt?: string
    kind?: PeraKeyKind
}

const peraKindToWalletType: Record<PeraKeyKind, KeyType> = {
    [PeraKeyKind.HDWalletRoot]: KeyType.HDWalletRootKey,
    [PeraKeyKind.Algo25Root]: KeyType.Algo25Key,
    [PeraKeyKind.DeterministicP256Root]: KeyType.DeterministicP256Key,
}

// Legacy fallback for entries committed before `pera.kind` was introduced.
// Once those entries are gone (or migrated), this map can be deleted.
const legacyKeystoreTypeToWalletType: Record<string, KeyType> = {
    'hd-root-key': KeyType.HDWalletRootKey,
    [ALGO25_KEYSTORE_TYPE]: KeyType.Algo25Key,
    'hd-derived-p256': KeyType.DeterministicP256Key,
}

/**
 * Maps a keystore Key into our wallet-domain KeyPair shape. Returns null for
 * keystore entries that aren't wallet-roots (HD-derived children of an HD
 * root, raw entropy/seed entries, etc.).
 *
 * Resolution prefers `pera.kind` (the canonical wallet-domain discriminator
 * stamped at commit time) and only falls back to the keystore `type` field
 * for legacy entries written before the kind tag was introduced.
 */
export const keystoreKeyToKeyPair = (key: Key): KeyPair | null => {
    const pera = (key.metadata?.[PERA_META_KEY] ?? {}) as PeraMetadata
    const walletType = pera.kind
        ? peraKindToWalletType[pera.kind]
        : legacyKeystoreTypeToWalletType[key.type]
    if (!walletType) return null

    const publicKey =
        walletType === KeyType.Algo25Key && key.publicKey
            ? encodeAddress(new Uint8Array(key.publicKey))
            : ''

    return {
        id: key.id,
        keystoreKeyId: key.id,
        publicKey,
        type: walletType,
        acl: pera.acl ?? [],
        createdAt: pera.createdAt ? new Date(pera.createdAt) : new Date(),
        expiresAt: pera.expiresAt ? new Date(pera.expiresAt) : undefined,
    }
}

/**
 * Builds the keystore-metadata payload that carries Pera-domain extras
 * through `keyStore.import` / `keyStore.generate`. Pass the result spread
 * into the `metadata` argument alongside any keystore-defined fields.
 */
export const peraMetadataFor = (
    keyPair: Pick<KeyPair, 'acl' | 'createdAt' | 'expiresAt'> & {
        kind?: PeraKeyKind
    },
): { [PERA_META_KEY]: PeraMetadata } => ({
    [PERA_META_KEY]: {
        acl: keyPair.acl,
        createdAt: (keyPair.createdAt ?? new Date()).toISOString(),
        expiresAt: keyPair.expiresAt?.toISOString(),
        ...(keyPair.kind ? { kind: keyPair.kind } : {}),
    },
})
