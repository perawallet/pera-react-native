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

import { isValidAlgorandAddress } from './addresses'

/**
 * Subset of an ARC-0001 sign-transaction request entry that this validator
 * inspects. The wire shape (per ARC-0001) also includes `txn` and `message`
 * fields, but those aren't relevant to the address-validity checks here.
 */
export type Arc0001SignTxnParam = {
    /** Rekeyed auth address that should sign on behalf of the sender. */
    authAddr?: string
    /** Addresses that must sign. Empty array = do not sign. */
    signers?: string[]
}

export type Arc0001ValidationError = {
    index: number
    field: 'authAddr' | 'signers'
    message: string
}

/**
 * Validates the address fields of an ARC-0001 sign-transaction request.
 *
 * Returns a non-null error on the first failure so callers can surface a
 * specific message; returns null if every entry checks out. Order:
 *
 * 1. `authAddr` (when present) must be a valid Algorand address.
 * 2. Every entry in `signers` (when non-empty) must be a valid Algorand address.
 *
 * An empty `signers` array is allowed — per ARC-0001 it means "do not sign".
 */
export const validateArc0001SignTxnParams = (
    params: Arc0001SignTxnParam[],
): Arc0001ValidationError | null => {
    for (let i = 0; i < params.length; i++) {
        const p = params[i]

        if (p.authAddr !== undefined && !isValidAlgorandAddress(p.authAddr)) {
            return {
                index: i,
                field: 'authAddr',
                message: `Invalid auth address at transaction index ${i}`,
            }
        }

        if (p.signers && p.signers.length > 0) {
            for (const signer of p.signers) {
                if (!isValidAlgorandAddress(signer)) {
                    return {
                        index: i,
                        field: 'signers',
                        message: `Invalid signer address at transaction index ${i}`,
                    }
                }
            }
        }
    }

    return null
}
