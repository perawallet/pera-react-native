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

import { describe, expect, it } from 'vitest'
import { MAX_DATA_SIGN_REQUESTS } from '@perawallet/wallet-core-signing'
import { arc0001GroupSchema, legacyArbitraryDataSchema } from '../schema'

describe('arc0001GroupSchema', () => {
    // The slot shape itself is the resolver's own schema, covered by
    // packages/blockchain's schema.spec.ts. The one thing this boundary adds
    // is the non-empty requirement.
    it('rejects an empty group', () => {
        const parsed = arc0001GroupSchema.safeParse([])

        expect(parsed.success).toBe(false)
    })
})

describe('legacyArbitraryDataSchema', () => {
    it('caps the batch at the signing pipeline maximum', () => {
        const item = { data: 'ZGF0YQ==', signer: 'A'.repeat(58) }
        const parsed = legacyArbitraryDataSchema.safeParse(
            Array.from({ length: MAX_DATA_SIGN_REQUESTS + 1 }, () => item),
        )

        expect(parsed.success).toBe(false)
    })
})
