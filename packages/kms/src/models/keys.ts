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
import { KeyManagementError } from '../errors'

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
 * rekeyed to it, so its key can never be retired.
 */
export type PQDerivation =
    | typeof PQ_DERIVATION_LEGACY
    | typeof PQ_DERIVATION_CANONICAL

/**
 * The chain's half of quantum key creation. kms generates and seals the Falcon
 * key; the canonical keygen-seed hash and the address encoding are the chain's
 * protocol rules, so the chain package supplies them.
 */
export type QuantumChainDerivation = {
    /** Canonical Falcon keygen seed for 32 bytes of entropy. Secret material;
     * the caller zeroes it. Must not mutate `entropy`. */
    deriveKeygenSeed(entropy: Uint8Array): Uint8Array
    addressFromPublicKey(publicKey: Uint8Array): string
}

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

/**
 * Deterministic keystore id for the BIP-32 secp256k1 child of a seed at the
 * given account and key index. `bip32` names the derivation standard, not the
 * curve, so it never collides with an ed25519 child's `-accN-idxN-dtN` id.
 */
export const secp256k1SignKeyId = (
    seedId: string,
    account: number,
    keyIndex: number,
): string => `${seedId}-bip32-acc${account}-idx${keyIndex}`

export const SECP256K1_KEY_SCHEME = 'secp256k1'

export type Secp256k1KeyOrigin = 'derived' | 'imported'

/**
 * Metadata on a secp256k1 key's keystore entry. The secrets API stamps every
 * entry `type: 'secret-key'`, so the scheme is recorded here instead, nested
 * under `pera` because keystore-core reserves top-level keys such as `scheme`.
 */
export type Secp256k1KeyMetadata = {
    parentKeyId?: string
    pera: {
        keyScheme: typeof SECP256K1_KEY_SCHEME
        origin: Secp256k1KeyOrigin
        /** Hex of the 65-byte uncompressed SEC1 public key. */
        publicKey: string
    }
}

export const isSecp256k1Key = (key: Key | undefined): boolean => {
    const pera = (key?.metadata as Partial<Secp256k1KeyMetadata> | undefined)
        ?.pera
    return (
        key?.type === 'secret-key' && pera?.keyScheme === SECP256K1_KEY_SCHEME
    )
}

/**
 * `r` and `s` are 32-byte big-endian with `s ≤ n/2`. `recovery` is the raw
 * y-parity of R, never an offset form such as 27/28.
 */
export type Secp256k1Signature = {
    r: Uint8Array
    s: Uint8Array
    recovery: 0 | 1
}

const SIGNATURE_SCALAR_LENGTH = 32
const ENCODED_SIGNATURE_LENGTH = 2 * SIGNATURE_SCALAR_LENGTH + 1

/** `r‖s‖recovery`, 65 bytes: what the chain-facing `sign` returns for a secp256k1 key. */
export const encodeSecp256k1Signature = ({
    r,
    s,
    recovery,
}: Secp256k1Signature): Uint8Array => {
    const out = new Uint8Array(ENCODED_SIGNATURE_LENGTH)
    out.set(r, 0)
    out.set(s, SIGNATURE_SCALAR_LENGTH)
    out[ENCODED_SIGNATURE_LENGTH - 1] = recovery
    return out
}

export const decodeSecp256k1Signature = (
    bytes: Uint8Array,
): Secp256k1Signature => {
    const recovery = bytes[ENCODED_SIGNATURE_LENGTH - 1]
    if (
        bytes.length !== ENCODED_SIGNATURE_LENGTH ||
        (recovery !== 0 && recovery !== 1)
    ) {
        throw new KeyManagementError('Malformed secp256k1 signature')
    }
    return {
        r: bytes.slice(0, SIGNATURE_SCALAR_LENGTH),
        s: bytes.slice(SIGNATURE_SCALAR_LENGTH, 2 * SIGNATURE_SCALAR_LENGTH),
        recovery,
    }
}
