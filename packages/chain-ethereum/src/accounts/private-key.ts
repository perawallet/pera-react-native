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

import type { AccountsChainAdapter } from '@perawallet/wallet-core-accounts'
import {
    AppError,
    ErrorCategory,
    ErrorSeverity,
} from '@perawallet/wallet-core-shared'

/** The secp256k1 group order; a valid private key is in [1, n - 1]. */
const SECP256K1_ORDER = BigInt(
    '0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141',
)

const PRIVATE_KEY_PATTERN = /^(?:0[xX])?([0-9a-fA-F]{64})$/

/** Carries no params and a fixed message: the rejected input is a secret and must never reach a log. */
export class InvalidPrivateKeyError extends AppError {
    constructor() {
        super('Invalid private key', {
            severity: ErrorSeverity.LOW,
            category: ErrorCategory.VALIDATION,
            messageKey: 'errors.evm.invalid_private_key',
        })
    }
}

/**
 * The 32 key bytes of a pasted private key: optional `0x` prefix, then exactly
 * 64 hex characters, in the range [1, n - 1]. The caller zeroes the result.
 */
export const parseEthereumPrivateKey = (input: string): Uint8Array => {
    const hex = PRIVATE_KEY_PATTERN.exec(input.trim())?.[1]
    if (!hex) throw new InvalidPrivateKeyError()
    const key = BigInt(`0x${hex}`)
    if (key === BigInt(0) || key >= SECP256K1_ORDER)
        throw new InvalidPrivateKeyError()
    const bytes = new Uint8Array(32)
    for (let i = 0; i < 32; i++) {
        bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    }
    return bytes
}

export const revealEthereumPrivateKey: NonNullable<
    AccountsChainAdapter['revealPrivateKey']
> = (keystore, keyPairId, domain) =>
    keystore.exportSecp256k1Key(keyPairId, domain)
