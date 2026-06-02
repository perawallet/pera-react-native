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

import { cborEncodeMap, type CborMap } from '../encoding/cbor'

// COSE_Key label/value constants (RFC 8152 / RFC 9053).
const COSE_KTY = 1
const COSE_ALG = 3
const COSE_CRV = -1
const COSE_X = -2
const COSE_Y = -3

const KTY_EC2 = 2
const ALG_ES256 = -7
const CRV_P256 = 1

/**
 * Build a COSE_Key (CBOR map) describing an EC2 P-256 public key for ES256.
 *
 * Labels are emitted in canonical order: kty, alg, crv, x, y. `x` and `y` must
 * be the 32-byte big-endian affine coordinates.
 */
export const coseP256PublicKey = (x: Uint8Array, y: Uint8Array): Uint8Array => {
    if (x.length !== 32) {
        throw new Error(`cose: x coordinate must be 32 bytes, got ${x.length}`)
    }
    if (y.length !== 32) {
        throw new Error(`cose: y coordinate must be 32 bytes, got ${y.length}`)
    }
    const entries: CborMap = [
        [COSE_KTY, KTY_EC2],
        [COSE_ALG, ALG_ES256],
        [COSE_CRV, CRV_P256],
        [COSE_X, x],
        [COSE_Y, y],
    ]
    return cborEncodeMap(entries)
}
