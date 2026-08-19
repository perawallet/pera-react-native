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
import { webcrypto } from 'node:crypto'
import * as falcon from 'falcon-1024'
import {
    consumeKeyMaterial,
    FALCON_ALGORITHM,
    withSubtleFalcon1024,
} from '@algorandfoundation/keystore-core'

// Custody of quantum keys moved into keystore-core's Falcon shim, but every
// address fixture and the on-chain adapter are built on `falcon-1024` called
// directly. Nothing else in the repo proves the two paths agree, so this file
// is the byte-parity gate: if the shim ever wraps a different primitive or
// pre-hashes the seed, previously-derived quantum addresses stop resolving.
//
// Scope: WASM/off-device only. On device, react-native-keystore injects
// `@joe-p/react-native-falcon` instead (RN cannot load WASM), so native-vs-WASM
// parity from a given seed is a manual device-checklist item, not covered here.

const SEED = new Uint8Array(48).fill(7)
const MESSAGE = new TextEncoder().encode('parity probe payload')
const OTHER_MESSAGE = new TextEncoder().encode('a different payload')

// The shim zero-fills every buffer it is handed (seed, injected private key),
// so each call needs its own copy or the next one silently signs with zeros.
const copy = (bytes: Uint8Array): Uint8Array => new Uint8Array(bytes)

const falconSubtle = (): SubtleCrypto =>
    withSubtleFalcon1024(webcrypto.subtle as unknown as SubtleCrypto, falcon)

const generateThroughShim = async (): Promise<{
    publicKey: Uint8Array
    privateKey: Uint8Array
}> => {
    const pair = (await falconSubtle().generateKey(
        {
            name: FALCON_ALGORITHM,
            seed: copy(SEED),
        } as unknown as AlgorithmIdentifier,
        false,
        ['sign', 'verify'],
    )) as CryptoKeyPair
    return {
        publicKey: consumeKeyMaterial(pair.publicKey, copy),
        privateKey: consumeKeyMaterial(pair.privateKey, copy),
    }
}

const signThroughShim = async (
    privateKey: Uint8Array,
    message: Uint8Array,
): Promise<Uint8Array> =>
    new Uint8Array(
        await falconSubtle().sign(
            {
                name: FALCON_ALGORITHM,
                privateKey: copy(privateKey),
            } as unknown as AlgorithmIdentifier,
            {} as CryptoKey,
            message,
        ),
    )

describe('keystore-core Falcon parity with falcon-1024', () => {
    it('derives a byte-identical keypair from the same seed', async () => {
        const direct = falcon.generateKey(copy(SEED))

        const viaShim = await generateThroughShim()

        expect(viaShim.publicKey).toEqual(direct.publicKey)
        expect(viaShim.privateKey).toEqual(direct.privateKey)
        // Algorand's pqsig encoding keys off this leading byte; an unexpected
        // value means the shim handed back something that is not a raw
        // Falcon-1024 public key.
        expect(viaShim.publicKey[0]).toBe(10)
    })

    it('produces the same signature bytes as signCompressed', async () => {
        const { privateKey } = await generateThroughShim()

        const viaShim = await signThroughShim(privateKey, MESSAGE)

        // falcon-1024 is the *deterministic* Falcon variant (FALCON_DET1024):
        // signing is a pure function of (private key, message), so the shim's
        // output is comparable byte-for-byte rather than only verifiable.
        expect(viaShim).toEqual(
            falcon.signCompressed(copy(privateKey), MESSAGE),
        )
    })

    it('signs deterministically per payload and verifies against the shim public key', async () => {
        const { publicKey, privateKey } = await generateThroughShim()

        const first = await signThroughShim(privateKey, MESSAGE)
        const second = await signThroughShim(privateKey, MESSAGE)
        const other = await signThroughShim(privateKey, OTHER_MESSAGE)

        expect(first).toEqual(second)
        expect(other).not.toEqual(first)
        expect(falcon.verifyCompressed(copy(publicKey), first, MESSAGE)).toBe(
            true,
        )
        expect(
            await falconSubtle().verify(
                {
                    name: FALCON_ALGORITHM,
                    publicKey: copy(publicKey),
                } as unknown as AlgorithmIdentifier,
                {} as CryptoKey,
                other,
                MESSAGE,
            ),
        ).toBe(false)
    })
})
