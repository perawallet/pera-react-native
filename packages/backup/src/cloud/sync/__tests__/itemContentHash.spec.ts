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

// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { accountItemKey, passkeyItemKey } from '../../models'
import { itemContentHash } from '../itemContentHash'

const HASH = 'a'.repeat(64)

const passkeyRecord = {
    credentialId: 'cred',
    origin: 'webauthn.io',
    publicKeySpkiDer: 'cHVi',
    displayName: 'Alice',
    createdAt: 1,
}

describe('itemContentHash', () => {
    it('ignores updatedAt', () => {
        const key = accountItemKey(HASH)

        expect(
            itemContentHash(key, { type: 'watch', address: 'A', updatedAt: 1 }),
        ).toBe(
            itemContentHash(key, { type: 'watch', address: 'A', updatedAt: 2 }),
        )
    })

    // A device that restored the credential from its key has no seed link and
    // backfills userId, so the original and the copy must hash the same.
    it('ignores the fields that depend on how a device holds a passkey', () => {
        const key = passkeyItemKey(HASH)

        expect(
            itemContentHash(key, {
                ...passkeyRecord,
                seedAddress: 'SEED',
                userId: 'dXNlcg',
            }),
        ).toBe(itemContentHash(key, passkeyRecord))
    })

    it('still sees a change to what the passkey is', () => {
        const key = passkeyItemKey(HASH)

        expect(
            itemContentHash(key, { ...passkeyRecord, displayName: 'Bob' }),
        ).not.toBe(itemContentHash(key, passkeyRecord))
    })

    it('keeps those fields significant outside passkey records', () => {
        const key = accountItemKey(HASH)

        expect(
            itemContentHash(key, { address: 'A', seedAddress: 'SEED' }),
        ).not.toBe(itemContentHash(key, { address: 'A' }))
    })
})
