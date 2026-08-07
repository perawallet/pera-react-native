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

import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPQProvider } from '@perawallet/wallet-core-kms'
import {
    createReactNativeKeyStore,
    resetTestKeystore,
} from '../algorand-keystore-test'

// The unit setup stubs the whole kms package; the double reaches the real PQ
// seam through it, and asserting Falcon parity against a stub would be
// circular.
vi.unmock('@perawallet/wallet-core-kms')

// The double is aliased over `@algorandfoundation/react-native-keystore` for the
// whole integration suite, so a surface that drifts from canary.14 leaves ~370
// tests green against an API the real library no longer has. This file pins the
// shape those tests silently depend on.

type StoreState = {
    keys: { id: string; type: string; [k: string]: unknown }[]
    status: string
    algorithms?: { algorithm: string; source: 'host' | 'shim' }[]
}

const createStore = () => {
    let state: StoreState = { keys: [], status: 'idle' }
    return {
        get state() {
            return state
        },
        setState: (updater: (s: StoreState) => StoreState) => {
            state = updater(state)
        },
        subscribe: () => ({ unsubscribe: () => {} }),
    }
}

const SEED = new Uint8Array(32).fill(3)

afterEach(() => {
    resetTestKeystore()
})

describe('algorand-keystore-test double', () => {
    it('mirrors the canary.14 keystore surface', async () => {
        const store = createStore()

        const keystore = createReactNativeKeyStore({ store })
        await keystore.ready

        expect(typeof keystore.generate).toBe('function')
        // canary.14 is `sign(id, data, algorithm?, ctx?)` — ctx TRAILING. A
        // double with the old `(id, ctx, data)` order would let every
        // integration test pass against a call shape the real library rejects.
        expect(keystore.sign.length).toBe(4)
        expect(
            store.state.algorithms?.some(a => a.algorithm === 'Falcon-1024'),
        ).toBe(true)
    })

    it('mints a Falcon child whose public key matches the app PQ seam', async () => {
        const store = createStore()
        const keystore = createReactNativeKeyStore({ store })
        await keystore.ready
        await keystore.import({
            id: 'seed-1',
            type: 'seed',
            algorithm: 'raw',
            privateKey: new Uint8Array(SEED),
        })

        const id = await keystore.generate({
            type: 'falcon-1024',
            algorithm: 'Falcon-1024',
            params: {
                id: 'seed-1-quantum-sign',
                parentKeyId: 'seed-1',
                seed: new Uint8Array(SEED),
            },
        })

        // `params.id` must win — the engine resolves `params?.id ?? randomUUID()`,
        // and kms addresses the quantum child by a derived, stable id.
        expect(id).toBe('seed-1-quantum-sign')
        const { publicKey } = await keystore.export(id)
        expect(publicKey).toEqual(
            getPQProvider().generateKeypairFromSeed(new Uint8Array(SEED))
                .publicKey,
        )
    })

    it('signs Falcon children with a Falcon-sized, seed-stable signature', async () => {
        const store = createStore()
        const keystore = createReactNativeKeyStore({ store })
        await keystore.ready
        await keystore.import({
            id: 'seed-2',
            type: 'seed',
            algorithm: 'raw',
            privateKey: new Uint8Array(SEED),
        })
        const id = await keystore.generate({
            type: 'falcon-1024',
            algorithm: 'Falcon-1024',
            params: { parentKeyId: 'seed-2', seed: new Uint8Array(SEED) },
        })
        const payload = new TextEncoder().encode('a quantum payload')

        const signature = await keystore.sign(id, payload)

        // Not a verifiable Falcon signature — the library lives behind the kms
        // PQ seam and the real keystore signs from sealed material. What the
        // integration suite needs from the double is the SHAPE: a carrier far
        // larger than the 64-byte Ed25519 stub (the WC PQ-fee flow asserts
        // >1000 bytes) that is stable per payload.
        expect(signature.length).toBeGreaterThan(1000)
        expect(signature).toEqual(await keystore.sign(id, payload))
        expect(signature).not.toEqual(
            await keystore.sign(id, new TextEncoder().encode('other')),
        )
    })
})
