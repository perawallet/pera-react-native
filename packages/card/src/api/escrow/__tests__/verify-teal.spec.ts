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

import { describe, it, expect } from 'vitest'
import nacl from 'tweetnacl'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import { AUTODRAW_TEAL_TEMPLATE } from '../autodraw-teal'
import {
    isAutoDrawTealSignatureValid,
    verifyAutoDrawTealTemplate,
    AUTODRAW_TEAL_PUBLIC_KEY,
    AUTODRAW_TEAL_SIGNATURE,
} from '../verify-teal'

// `Uint8Array.from` keeps tweetnacl's cross-realm instanceof check happy under
// vitest — see the same normalization in verify-teal.ts.
const templateBytes = Uint8Array.from(
    new TextEncoder().encode(AUTODRAW_TEAL_TEMPLATE),
)

describe('isAutoDrawTealSignatureValid', () => {
    it('accepts a signature the pinned key would produce over the exact template', () => {
        const keyPair = nacl.sign.keyPair()
        const signature = nacl.sign.detached(templateBytes, keyPair.secretKey)

        expect(
            isAutoDrawTealSignatureValid(
                encodeToBase64(keyPair.publicKey),
                encodeToBase64(signature),
            ),
        ).toBe(true)
    })

    it('rejects a signature over DIFFERENT bytes (tampered template)', () => {
        const keyPair = nacl.sign.keyPair()
        const signature = nacl.sign.detached(
            Uint8Array.from(
                new TextEncoder().encode(
                    `${AUTODRAW_TEAL_TEMPLATE}// tampered`,
                ),
            ),
            keyPair.secretKey,
        )

        expect(
            isAutoDrawTealSignatureValid(
                encodeToBase64(keyPair.publicKey),
                encodeToBase64(signature),
            ),
        ).toBe(false)
    })

    it('rejects a signature from a DIFFERENT key', () => {
        const signer = nacl.sign.keyPair()
        const other = nacl.sign.keyPair()
        const signature = nacl.sign.detached(templateBytes, signer.secretKey)

        expect(
            isAutoDrawTealSignatureValid(
                encodeToBase64(other.publicKey),
                encodeToBase64(signature),
            ),
        ).toBe(false)
    })

    it('rejects empty material (never throws)', () => {
        expect(isAutoDrawTealSignatureValid('', '')).toBe(false)
        expect(isAutoDrawTealSignatureValid('not-base64!!', 'x')).toBe(false)
    })
})

describe('verifyAutoDrawTealTemplate', () => {
    it('is dormant (does not throw) while the pinned material is unset', () => {
        // Pre-launch placeholder state — verification is intentionally dormant.
        expect(AUTODRAW_TEAL_PUBLIC_KEY).toBe('')
        expect(AUTODRAW_TEAL_SIGNATURE).toBe('')
        expect(() => verifyAutoDrawTealTemplate()).not.toThrow()
    })
})
