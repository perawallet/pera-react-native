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
import { sha256 } from '@noble/hashes/sha2.js'
import { AutoDrawTealUnverifiedError } from '@perawallet/wallet-core-card'
import { bytesToHex } from '@perawallet/wallet-core-shared'
import { AUTODRAW_TEAL_TEMPLATE } from '../autodraw-teal'
import {
    computeAutoDrawTemplateHash,
    verifyAutoDrawTealTemplate,
} from '../verify-teal'

const hashOf = (text: string) =>
    bytesToHex(sha256(new TextEncoder().encode(text)))

describe('computeAutoDrawTemplateHash', () => {
    it('is the lowercase hex SHA-256 of the exact template bytes', () => {
        expect(computeAutoDrawTemplateHash()).toBe(
            hashOf(AUTODRAW_TEAL_TEMPLATE),
        )
        expect(computeAutoDrawTemplateHash()).toMatch(/^[0-9a-f]{64}$/)
    })
})

describe('verifyAutoDrawTealTemplate', () => {
    it('accepts the pinned hash', () => {
        expect(() =>
            verifyAutoDrawTealTemplate(hashOf(AUTODRAW_TEAL_TEMPLATE)),
        ).not.toThrow()
    })

    // The pin is pasted into Bitrise by hand; tolerate the casing and
    // whitespace that survives a copy-paste instead of failing closed on it.
    it('accepts an upper-case, padded pin', () => {
        expect(() =>
            verifyAutoDrawTealTemplate(
                `  ${hashOf(AUTODRAW_TEAL_TEMPLATE).toUpperCase()}  `,
            ),
        ).not.toThrow()
    })

    it('rejects a pin for different bytes (tampered template)', () => {
        expect(() =>
            verifyAutoDrawTealTemplate(
                hashOf(`${AUTODRAW_TEAL_TEMPLATE}// tampered`),
            ),
        ).toThrow(AutoDrawTealUnverifiedError)
    })

    it('rejects an empty pin (fail closed, no dormant mode)', () => {
        expect(() => verifyAutoDrawTealTemplate('')).toThrow(
            AutoDrawTealUnverifiedError,
        )
    })
})
