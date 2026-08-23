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

export const AccessControlPermission = {
    ReadPublic: 'read-public',
    ReadPrivate: 'read-private',
    Delete: 'delete',
    Refresh: 'refresh',
}

export type AccessControlPermission =
    (typeof AccessControlPermission)[keyof typeof AccessControlPermission]

export type AccessControl = {
    domains: string[]
    permissions: AccessControlPermission[]
}

/**
 * Deterministic keystore id for the Ed25519 signing child of an Algo25 seed.
 * One child per seed is created at seed-commit time; signing/lookup always
 * hits this id, so accounts never need to track it separately.
 */
export const algo25SignKeyId = (seedId: string): string => `${seedId}-ed25519`

export const PQ_DERIVATION_LEGACY = 'legacy'
export const PQ_DERIVATION_CANONICAL = 'pqk1'

/**
 * Which entropy→Falcon-keygen-seed mapping produced a quantum child.
 *
 * `legacy` fed Falcon the raw algo25 entropy, which is not what
 * `algokey pq` does, so the mnemonic restores a different account elsewhere.
 * `pqk1` is the canonical `SHA512_256("PQK" || scheme || entropy)`. Both are
 * supported permanently: a legacy address may be the `auth-addr` of accounts
 * rekeyed to it, so its key can never be retired. See PERA-4972.
 */
export type PQDerivation =
    | typeof PQ_DERIVATION_LEGACY
    | typeof PQ_DERIVATION_CANONICAL

/**
 * Deterministic keystore id for the quantum signing child of a quantum seed.
 *
 * Scheme-agnostic (`-quantum`, not `-falcon`) because accounts persist this as
 * `keyPairId` and a future scheme swap must not need a `keyPairId` migration.
 * It is NOT derivation-agnostic: one seed can host both a legacy and a
 * canonical child, so the derivation is part of the id. `legacy` keeps the
 * historical bare form — existing `keyPairId`s must keep resolving.
 */
export const quantumSignKeyId = (
    seedId: string,
    derivation: PQDerivation,
): string =>
    derivation === PQ_DERIVATION_LEGACY
        ? `${seedId}-quantum`
        : `${seedId}-quantum-${derivation}`

/**
 * Keystore entry `type` for the quantum signing child — this (not the id)
 * names the concrete algorithm, parallel to the `'ed25519'` child type of an
 * algo25 seed. Must stay spelled exactly as `keystore-core`'s `KeyType`: the
 * engine writes this literal onto the entry it generates, and every lookup
 * that guards "is this child quantum?" compares against it.
 */
export const FALCON_CHILD_KEY_TYPE = 'falcon-1024'
