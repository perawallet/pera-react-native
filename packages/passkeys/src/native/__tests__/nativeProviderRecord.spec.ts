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
import {
    fromNativeByteArray,
    openNativeProviderRecord,
    sealNativeProviderRecord,
    toNativeByteArray,
} from '../nativeProviderRecord'

const subtle = globalThis.crypto.subtle
const MASTER_KEY = new Uint8Array(32).fill(7)

/**
 * The record shapes the Android provider can put on disk, transcribed from
 * `CredentialRepository.saveCredential` / `getHdRootSecret`. This corpus is the
 * point of this file: phase 3 migrates these into `k/`+`m/`, and a shape that
 * is not represented here is a shape that migration will silently drop.
 */
const CREDENTIAL_WITH_PLAIN_KEY = {
    id: 'cred-plain',
    type: 'hd-derived-p256',
    algorithm: 'P256',
    extractable: false,
    keyUsages: ['sign'],
    name: 'Passkey: example.com',
    // Byte values, not {$u8} and not base64 — the provider calls getJSONArray.
    privateKey: toNativeByteArray(new Uint8Array(32).fill(3)),
    publicKey: toNativeByteArray(new Uint8Array(91).fill(4)),
    metadata: {
        origin: 'example.com',
        userHandle: 'dXNlcg',
        userId: 'user-1',
        count: 0,
    },
}

/**
 * Biometric-gated credentials carry the private key wrapped by an Android
 * Keystore cipher instead. `privateKeyEnc` is an OBJECT — a `Uint8Array`-only
 * secret lifter drops it, which is why the layout migration skips these records
 * wholesale rather than trying to re-seal them.
 */
const CREDENTIAL_WITH_WRAPPED_KEY = {
    ...CREDENTIAL_WITH_PLAIN_KEY,
    id: 'cred-biometric',
    privateKey: undefined,
    privateKeyEnc: { iv: 'aXY=', data: 'ZGF0YQ==' },
}

/** The HD root the provider derives new credentials from. */
const HD_ROOT_RECORD = {
    id: 'hd-root-1',
    type: 'hd-root-key',
    algorithm: 'raw',
    seed: toNativeByteArray(new Uint8Array(96).fill(9)),
}

describe('native credential-provider record contract', () => {
    it('round-trips every record shape the provider can write', async () => {
        for (const record of [
            CREDENTIAL_WITH_PLAIN_KEY,
            CREDENTIAL_WITH_WRAPPED_KEY,
            HD_ROOT_RECORD,
        ]) {
            const sealed = await sealNativeProviderRecord(
                subtle,
                MASTER_KEY,
                record,
            )
            await expect(
                openNativeProviderRecord(subtle, MASTER_KEY, sealed),
            ).resolves.toEqual(JSON.parse(JSON.stringify(record)))
        }
    })

    it('emits the three-field envelope the provider decrypts, not canary.14 two-field', async () => {
        const sealed = await sealNativeProviderRecord(
            subtle,
            MASTER_KEY,
            HD_ROOT_RECORD,
        )

        // decodeKeyData only decrypts when all three are present; with `tag`
        // folded into `content` it returns the envelope as if it were the
        // record, and the key material is silently invisible.
        expect(Object.keys(JSON.parse(sealed)).sort()).toEqual([
            'content',
            'iv',
            'tag',
        ])
    })

    it('reads the unsealed base64url payload the provider falls back to', async () => {
        // `saveCredential` writes this when no master key is available.
        const unsealed = btoa(JSON.stringify(CREDENTIAL_WITH_PLAIN_KEY))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '')

        await expect(
            openNativeProviderRecord(subtle, MASTER_KEY, unsealed),
        ).resolves.toEqual(CREDENTIAL_WITH_PLAIN_KEY)
    })

    it('keeps byte fields as number arrays, which is what the provider parses', async () => {
        const sealed = await sealNativeProviderRecord(subtle, MASTER_KEY, {
            privateKey: toNativeByteArray(Uint8Array.from([1, 2, 255])),
        })
        const opened = (await openNativeProviderRecord(
            subtle,
            MASTER_KEY,
            sealed,
        )) as { privateKey: number[] }

        expect(Array.isArray(opened.privateKey)).toBe(true)
        expect(fromNativeByteArray(opened.privateKey)).toEqual(
            Uint8Array.from([1, 2, 255]),
        )
    })

    it('rejects a canary.14 envelope rather than returning it as a record', async () => {
        // The shape `sealData` produces. Returning this silently is precisely
        // the provider-side bug we must not reproduce on the read path.
        const canary14Envelope = JSON.stringify({ iv: 'aXY=', content: 'Yw==' })

        await expect(
            openNativeProviderRecord(subtle, MASTER_KEY, canary14Envelope),
        ).rejects.toThrow(/expected iv, tag and content/)
    })
})
