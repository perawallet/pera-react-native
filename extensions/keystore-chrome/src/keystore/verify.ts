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
// Ported from @algorandfoundation/keystore@1.0.0-canary.17 verify.ts
// Portions Copyright Algorand Foundation, Apache-2.0
// node:crypto's `subtle` replaced by the web-standard `crypto.subtle` (see
// extensions/keystore-chrome's existing vault/vault.ts convention — this
// package targets the browser, not Node).

import { clearKeyData } from './crypto'
import { xhd } from '../libs'
import type { KeyData } from './types'

/**
 * Verifies a signature using the provided public key and data.
 *
 * @param params - The verification parameters.
 * @param params.key - The {@link KeyData} containing the public key.
 * @param params.data - The original data that was signed.
 * @param params.signature - The signature to verify.
 * @param params.algorithm - Optional algorithm to use.
 * @returns A promise that resolves to true if the signature is valid, false otherwise.
 */
export async function verifyWithKeyData({
    key,
    data,
    signature,
}: {
    key: KeyData
    data: Uint8Array<ArrayBufferLike>
    signature: Uint8Array<ArrayBufferLike>
    algorithm?: string
}): Promise<boolean> {
    try {
        if (typeof key.publicKey === 'undefined') {
            throw new Error('Key does not have a public key')
        }

        // TODO: Switch case with bespoke handlers
        if (key.algorithm === 'P256' || key.algorithm === 'P-256') {
            const fullPublicKey = new Uint8Array(65)
            fullPublicKey[0] = 0x04
            fullPublicKey.set(key.publicKey, 1)

            const cryptoKey = await crypto.subtle.importKey(
                'raw',
                fullPublicKey,
                { name: 'ECDSA', namedCurve: 'P-256' },
                false,
                ['verify'],
            )

            return await crypto.subtle.verify(
                { name: 'ECDSA', hash: 'SHA-256' },
                cryptoKey,
                new Uint8Array(signature),
                new Uint8Array(data),
            )
        }

        if (key.algorithm === 'EdDSA') {
            return await xhd.verifyWithPublicKey(signature, data, key.publicKey)
        }

        throw new Error(
            `Algorithm ${key.algorithm} is not supported for verification`,
        )
    } finally {
        clearKeyData(key)
    }
}
