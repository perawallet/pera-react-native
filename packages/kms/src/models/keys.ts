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

/**
 * Deterministic keystore id for the quantum signing child of a quantum seed.
 * Deliberately scheme-agnostic (`-quantum`, not `-falcon`): accounts persist
 * this id as `keyPairId`, so the concrete algorithm must not be baked into
 * it. The algorithm lives on the keystore entries instead (seed
 * `metadata.scheme`, child entry `type` — see {@link FALCON_CHILD_KEY_TYPE}),
 * so a future scheme swap needs no keyPairId migration.
 */
export const quantumSignKeyId = (seedId: string): string => `${seedId}-quantum`

/**
 * Keystore entry `type` for the quantum signing child — this (not the id)
 * names the concrete algorithm, parallel to the `'ed25519'` child type of an
 * algo25 seed. Must stay spelled exactly as `keystore-core`'s `KeyType`: the
 * engine writes this literal onto the entry it generates, and every lookup
 * that guards "is this child quantum?" compares against it.
 */
export const FALCON_CHILD_KEY_TYPE = 'falcon-1024'
