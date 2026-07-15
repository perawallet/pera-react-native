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

import { createHash } from 'crypto'
import { encodeAddress } from 'algosdk'
import { QUANTUM_SEED_LENGTH } from '../constants'

/** Byte length of a Falcon-1024 public key (per the Falcon specification). */
export const FALCON_PUBLIC_KEY_LENGTH = 1793

/** Byte length of a Falcon-1024 signature (the documented maximum). */
export const FALCON_SIGNATURE_LENGTH = 1423

// Same hash the algo25 mnemonic checksum uses — already ubiquitous in this
// package, and its 32-byte output makes counter-mode expansion trivial.
const EXPANSION_HASH = 'sha512-256'
const HASH_OUTPUT_LENGTH = 32

/**
 * Deterministically expands `material` to `length` bytes via counter-mode
 * hashing: `H(tag || material || counter_0) || H(tag || material ||
 * counter_1) || …`, truncated to `length`. The domain `tag` keeps the
 * public-key and signature expansions disjoint even for identical material;
 * the counter is 4 bytes big-endian.
 */
const expandDeterministic = (
    tag: string,
    material: Uint8Array,
    length: number,
): Uint8Array => {
    const out = new Uint8Array(length)
    const counter = new Uint8Array(4)
    for (
        let offset = 0, block = 0;
        offset < length;
        offset += HASH_OUTPUT_LENGTH, block++
    ) {
        counter[0] = (block >>> 24) & 0xff
        counter[1] = (block >>> 16) & 0xff
        counter[2] = (block >>> 8) & 0xff
        counter[3] = block & 0xff
        const digest = createHash(EXPANSION_HASH)
            .update(tag)
            .update(material)
            .update(counter)
            .digest()
        out.set(
            digest.subarray(0, Math.min(HASH_OUTPUT_LENGTH, length - offset)),
            offset,
        )
        digest.fill(0)
    }
    return out
}

// MOCK(quantum): replace with real Falcon-1024 implementation when keystore support lands. See EPIC phase 2.
/**
 * Derives a signature-shaped falcon public key from a 32-byte seed by
 * counter-mode SHA-512/256 expansion (see {@link expandDeterministic}). Only
 * the size (1,793 bytes) and determinism matter — nothing verifies these
 * bytes cryptographically during the mock phase.
 */
export const deriveFalconKeypairMock = (
    seed: Uint8Array,
): { publicKey: Uint8Array } => {
    if (seed.length !== QUANTUM_SEED_LENGTH) {
        throw new RangeError(`Seed length must be ${QUANTUM_SEED_LENGTH}`)
    }
    return {
        publicKey: expandDeterministic(
            'falcon-mock-pubkey',
            seed,
            FALCON_PUBLIC_KEY_LENGTH,
        ),
    }
}

// MOCK(quantum): replace with real Falcon-1024 implementation when keystore support lands. See EPIC phase 2.
/**
 * Computes a valid, deterministic 58-character Algorand address as
 * `encodeAddress(SHA-512/256(publicKey))`. The real derivation for quantum
 * accounts will replace this leaf once the node release defines it.
 */
export const deriveFalconAddressMock = (publicKey: Uint8Array): string => {
    const digest = createHash(EXPANSION_HASH).update(publicKey).digest()
    return encodeAddress(new Uint8Array(digest))
}

// MOCK(quantum): replace with real Falcon-1024 implementation when keystore support lands. See EPIC phase 2.
/**
 * Produces a deterministic 1,423-byte signature-shaped blob per
 * (key, payload) pair: counter-mode expansion over
 * `SHA-512/256(privateSeed || payload)`.
 */
export const falconSignMock = (
    privateSeed: Uint8Array,
    payload: Uint8Array,
): Uint8Array => {
    const material = createHash(EXPANSION_HASH)
        .update(privateSeed)
        .update(payload)
        .digest()
    try {
        return expandDeterministic(
            'falcon-mock-signature',
            new Uint8Array(material),
            FALCON_SIGNATURE_LENGTH,
        )
    } finally {
        material.fill(0)
    }
}
