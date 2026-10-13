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

import { describe, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'

vi.mock('@perawallet/wallet-extension-provider', () => ({ keystoreSubtle: {} }))

import { p256PrivateKeyToSpkiDer } from '../derivePasskeyCredential'
import { p256PrivateKeyFromPkcs8 } from '../p256Pkcs8'

const subtle = webcrypto.subtle

/** What Android's `PrivateKey.encoded` looks like for a P-256 key. */
const generatePkcs8 = async (namedCurve = 'P-256') => {
    const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve }, true, [
        'sign',
        'verify',
    ])
    return {
        pkcs8: new Uint8Array(await subtle.exportKey('pkcs8', pair.privateKey)),
        spki: new Uint8Array(await subtle.exportKey('spki', pair.publicKey)),
    }
}

describe('p256PrivateKeyFromPkcs8', () => {
    it('extracts the scalar that produces the key pair public key', async () => {
        const { pkcs8, spki } = await generatePkcs8()

        const scalar = p256PrivateKeyFromPkcs8(pkcs8)

        expect(scalar).toHaveLength(32)
        expect(p256PrivateKeyToSpkiDer(scalar!)).toEqual(spki)
    })

    it('rejects a key on another curve', async () => {
        const { pkcs8 } = await generatePkcs8('P-384')

        expect(p256PrivateKeyFromPkcs8(pkcs8)).toBeNull()
    })

    it('rejects a raw scalar and truncated input', async () => {
        const { pkcs8 } = await generatePkcs8()

        expect(p256PrivateKeyFromPkcs8(new Uint8Array(32).fill(1))).toBeNull()
        expect(p256PrivateKeyFromPkcs8(pkcs8.subarray(0, 40))).toBeNull()
    })
})
