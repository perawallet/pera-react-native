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

import { bytesToHex } from 'viem'
import type { Signature } from 'viem'
import type { EvmDigestKind } from './digests'

const SIGNATURE_LENGTH = 65
const COMPONENT_LENGTH = 32

// Mirrors the KMS's `r‖s‖recovery` encoding; the kms barrel is fenced off from this package.
const decodeSignature = (
    bytes: Uint8Array,
): { r: Uint8Array; s: Uint8Array; recovery: 0 | 1 } => {
    const recovery = bytes[SIGNATURE_LENGTH - 1]
    if (
        bytes.length !== SIGNATURE_LENGTH ||
        (recovery !== 0 && recovery !== 1)
    ) {
        throw new Error(
            'The key store returned a malformed secp256k1 signature',
        )
    }
    return {
        r: bytes.slice(0, COMPONENT_LENGTH),
        s: bytes.slice(COMPONENT_LENGTH, 2 * COMPONENT_LENGTH),
        recovery,
    }
}

/**
 * Transactions get `yParity` (what `serializeTransaction` consumes); messages
 * and typed data get `v` of 27 or 28 (what `serializeSignature` consumes).
 */
export const toViemSignature = (
    bytes: Uint8Array,
    kind: EvmDigestKind,
): Signature => {
    const { r, s, recovery } = decodeSignature(bytes)
    const components = { r: bytesToHex(r), s: bytesToHex(s) }
    return kind === 'eip155-tx'
        ? { ...components, yParity: recovery }
        : { ...components, v: BigInt(27 + recovery) }
}
