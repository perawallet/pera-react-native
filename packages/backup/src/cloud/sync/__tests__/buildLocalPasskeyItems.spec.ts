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
import { createItemKeyHasher } from '../../crypto/itemKeyHash'
import {
    BackupItemType,
    passkeyItemKey,
    passkeySecretsItemKey,
} from '../../models'
import { buildLocalPasskeyItems } from '../buildLocalPasskeyItems'
import type { LocalPasskey } from '../types'

const hashAddress = createItemKeyHasher(new Uint8Array(32).fill(1))

const passkey: LocalPasskey = {
    credentialId: 'Y3JlZC1pZA==',
    origin: 'webauthn.io',
    identity: 'alice',
    counter: 0,
    publicKeySpkiDer: 'cHVi',
    seedAddress: 'SEEDADDRESS',
    userName: 'alice',
    displayName: 'Alice',
    createdAt: 1_700_000_000_000,
    privateKey: new Uint8Array(32).fill(9),
}

describe('buildLocalPasskeyItems', () => {
    it('builds a metadata item and a secrets item per credential', () => {
        const [record, secret] = buildLocalPasskeyItems(
            [passkey],
            42,
            hashAddress,
        )
        const hash = hashAddress(passkey.credentialId)

        // The key is an HMAC of the credential id, so the server never sees
        // which credentials a backup holds.
        expect(record!.key).toBe(passkeyItemKey(hash))
        expect(record!.key).not.toContain(passkey.credentialId)
        expect(record!.type).toBe(BackupItemType.PASSKEY)
        expect(record!.payload).toMatchObject({
            credentialId: 'Y3JlZC1pZA==',
            identity: 'alice',
            seedAddress: 'SEEDADDRESS',
            updatedAt: 42,
        })
        expect(secret!.key).toBe(passkeySecretsItemKey(hash))
        expect(secret!.type).toBe(BackupItemType.PASSKEY)
        expect(secret!.payload).toEqual({
            credentialId: 'Y3JlZC1pZA==',
            privateKey: Buffer.from(passkey.privateKey).toString('base64'),
        })
    })

    it('keeps the private key out of the metadata item', () => {
        const [record] = buildLocalPasskeyItems([passkey], 1, hashAddress)

        expect(record!.payload).not.toHaveProperty('privateKey')
    })

    it('hashes content without updatedAt so a timestamp bump is not dirty', () => {
        const [first] = buildLocalPasskeyItems([passkey], 1, hashAddress)
        const [second] = buildLocalPasskeyItems([passkey], 999, hashAddress)

        expect(first!.contentHash).toBe(second!.contentHash)
    })

    it('hashes the secret differently when the key changes', () => {
        const [, first] = buildLocalPasskeyItems([passkey], 1, hashAddress)
        const [, second] = buildLocalPasskeyItems(
            [{ ...passkey, privateKey: new Uint8Array(32).fill(8) }],
            1,
            hashAddress,
        )

        expect(first!.contentHash).not.toBe(second!.contentHash)
    })

    it('returns an empty list for no credentials', () => {
        expect(buildLocalPasskeyItems([], 1, hashAddress)).toEqual([])
    })
})
