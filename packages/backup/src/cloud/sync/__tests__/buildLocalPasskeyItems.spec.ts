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
import { BackupItemType } from '../../models'
import { buildLocalPasskeyItems } from '../buildLocalPasskeyItems'
import type { BackupPasskey } from '../types'

const passkey: BackupPasskey = {
    credentialId: 'Y3JlZC1pZA==',
    origin: 'webauthn.io',
    identity: 'alice',
    counter: 0,
    publicKeySpkiDer: 'cHVi',
    seedAddress: 'SEEDADDRESS',
    userName: 'alice',
    displayName: 'Alice',
    createdAt: 1_700_000_000_000,
}

describe('buildLocalPasskeyItems', () => {
    it('builds one PASSKEY item per credential under the passkeys prefix', () => {
        const [item] = buildLocalPasskeyItems([passkey], 42)

        // The id's bytes travel base64url: the server's key alphabet has no
        // '+', '/' or '='.
        expect(item.key).toBe('passkeys/WTNKbFpDMXBaQT09')
        expect(item.type).toBe(BackupItemType.PASSKEY)
        expect(item.payload).toMatchObject({
            credentialId: 'Y3JlZC1pZA==',
            identity: 'alice',
            seedAddress: 'SEEDADDRESS',
            updatedAt: 42,
        })
    })

    it('hashes content without updatedAt so a timestamp bump is not dirty', () => {
        const [first] = buildLocalPasskeyItems([passkey], 1)
        const [second] = buildLocalPasskeyItems([passkey], 999)

        expect(first.contentHash).toBe(second.contentHash)
    })

    it('hashes differently when a derivation input changes', () => {
        const [first] = buildLocalPasskeyItems([passkey], 1)
        const [second] = buildLocalPasskeyItems([{ ...passkey, counter: 1 }], 1)

        expect(first.contentHash).not.toBe(second.contentHash)
    })

    it('returns an empty list for no credentials', () => {
        expect(buildLocalPasskeyItems([], 1)).toEqual([])
    })
})
