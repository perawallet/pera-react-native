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
import { passkeysFingerprint } from '../passkeysFingerprint'
import type { BackupPasskey } from '../types'

const passkey: BackupPasskey = {
    credentialId: 'Y3JlZC1pZA==',
    origin: 'webauthn.io',
    identity: 'alice',
    counter: 0,
    publicKeySpkiDer: 'cHVi',
    seedAddress: 'SEEDADDRESS',
    createdAt: 1,
}

describe('passkeysFingerprint', () => {
    it('is stable for the same credentials in a different order', () => {
        const other = { ...passkey, credentialId: 'b' }

        expect(passkeysFingerprint([passkey, other])).toBe(
            passkeysFingerprint([other, passkey]),
        )
    })

    it('changes when a credential is added', () => {
        expect(passkeysFingerprint([passkey])).not.toBe(
            passkeysFingerprint([passkey, { ...passkey, credentialId: 'b' }]),
        )
    })

    it('changes when a derivation input changes', () => {
        expect(passkeysFingerprint([passkey])).not.toBe(
            passkeysFingerprint([{ ...passkey, counter: 1 }]),
        )
    })
})
