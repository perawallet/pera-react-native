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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Key } from '@algorandfoundation/keystore-core'

// The package root executes native Keychain/Nitro bindings at import time,
// which node cannot run. `driver.js` depends only on `@scure/base` and
// `keystore-core`, so `MATERIAL_PREFIX` from it is the genuine article — see
// the other keystore specs mocking the same way.
vi.mock('@algorandfoundation/react-native-keystore', async () => {
    const driver =
        await import('../../../node_modules/@algorandfoundation/react-native-keystore/dist/storage/driver.js')

    return { MATERIAL_PREFIX: driver.MATERIAL_PREFIX }
})

import {
    repairQuantumMaterial,
    type QuantumMaterialRepairDeps,
} from '../repairQuantumMaterial'

const PUBLIC_KEY = new Uint8Array(1793).fill(10)

const quantumChild = (overrides: Partial<Key> = {}): Key =>
    ({
        id: 'seed-1-quantum',
        type: 'falcon-1024',
        algorithm: 'Falcon-1024',
        extractable: false,
        publicKey: PUBLIC_KEY,
        metadata: { parentKeyId: 'seed-1', pqDerivation: 'legacy' },
        ...overrides,
    }) as Key

let keys: Key[]
let material: Map<string, string>
let regenerate: ReturnType<typeof vi.fn>

const deps = (): QuantumMaterialRepairDeps => ({
    keys: () => keys,
    storage: { getString: (key: string) => material.get(key) },
    regenerate: regenerate as QuantumMaterialRepairDeps['regenerate'],
})

describe('repairQuantumMaterial', () => {
    beforeEach(() => {
        keys = [quantumChild()]
        material = new Map()
        // The real engine seals material as a side effect of re-minting.
        regenerate = vi.fn(async (childId: string) => {
            material.set(`m/${childId}`, 'sealed')
        })
    })

    it('re-mints a quantum child that has no sealed material', async () => {
        const result = await repairQuantumMaterial(deps())

        expect(regenerate).toHaveBeenCalledWith(
            'seed-1-quantum',
            'seed-1',
            'legacy',
        )
        expect(result).toEqual({ repaired: 1, failed: 0 })
    })

    it('leaves a child that already holds material alone', async () => {
        material.set('m/seed-1-quantum', 'sealed')

        const result = await repairQuantumMaterial(deps())

        expect(regenerate).not.toHaveBeenCalled()
        expect(result).toEqual({ repaired: 0, failed: 0 })
    })

    it('ignores non-quantum keys with no material', async () => {
        keys = [
            {
                id: 'derived-1',
                type: 'hd-derived-ed25519',
                algorithm: 'EdDSA',
                extractable: false,
            } as Key,
        ]

        const result = await repairQuantumMaterial(deps())

        expect(regenerate).not.toHaveBeenCalled()
        expect(result).toEqual({ repaired: 0, failed: 0 })
    })

    it('reports a child whose parent seed is unknown', async () => {
        keys = [quantumChild({ metadata: {} })]

        const result = await repairQuantumMaterial(deps())

        expect(regenerate).not.toHaveBeenCalled()
        expect(result).toEqual({ repaired: 0, failed: 1 })
    })

    // A different public key means a different address — the account would be
    // silently replaced rather than repaired.
    it('reports a re-derivation that changes the public key', async () => {
        regenerate = vi.fn(async (childId: string) => {
            material.set(`m/${childId}`, 'sealed')
            keys = [quantumChild({ publicKey: new Uint8Array(1793).fill(11) })]
        })

        const result = await repairQuantumMaterial(deps())

        expect(result).toEqual({ repaired: 0, failed: 1 })
    })

    it('keeps repairing after one child fails', async () => {
        keys = [
            quantumChild({ id: 'a-quantum', metadata: {} }),
            quantumChild({
                id: 'b-quantum',
                metadata: { parentKeyId: 'b', pqDerivation: 'legacy' },
            }),
        ]

        const result = await repairQuantumMaterial(deps())

        expect(regenerate).toHaveBeenCalledWith('b-quantum', 'b', 'legacy')
        expect(result).toEqual({ repaired: 1, failed: 1 })
    })

    it('re-mints a legacy child from the parent seed, without a derived seed', async () => {
        const calls: { childId: string; derivation: string }[] = []
        const publicKey = new Uint8Array([1, 2, 3])

        const result = await repairQuantumMaterial({
            keys: () => [
                {
                    id: 'seed-1-quantum',
                    type: 'falcon-1024',
                    publicKey,
                    metadata: { parentKeyId: 'seed-1', pqDerivation: 'legacy' },
                } as never,
            ],
            storage: { getString: () => undefined },
            regenerate: async (childId, _parentKeyId, derivation) => {
                calls.push({ childId, derivation })
            },
        })

        expect(result).toEqual({ repaired: 1, failed: 0 })
        expect(calls).toEqual([
            { childId: 'seed-1-quantum', derivation: 'legacy' },
        ])
    })

    it('passes the canonical derivation through for a pqk1 child', async () => {
        const calls: string[] = []

        await repairQuantumMaterial({
            keys: () => [
                {
                    id: 'seed-2-quantum-pqk1',
                    type: 'falcon-1024',
                    publicKey: new Uint8Array([4, 5, 6]),
                    metadata: { parentKeyId: 'seed-2', pqDerivation: 'pqk1' },
                } as never,
            ],
            storage: { getString: () => undefined },
            regenerate: async (_childId, _parentKeyId, derivation) => {
                calls.push(derivation)
            },
        })

        expect(calls).toEqual(['pqk1'])
    })

    it('fails closed on a child with no derivation marker', async () => {
        // Guessing re-mints the wrong keypair, which changes the address. The
        // account stays unusable until revision 0004 has stamped it, which is
        // recoverable; a wrong re-mint is not.
        let regenerated = false

        const result = await repairQuantumMaterial({
            keys: () => [
                {
                    id: 'seed-3-quantum',
                    type: 'falcon-1024',
                    publicKey: new Uint8Array([7]),
                    metadata: { parentKeyId: 'seed-3' },
                } as never,
            ],
            storage: { getString: () => undefined },
            regenerate: async () => {
                regenerated = true
            },
        })

        expect(regenerated).toBe(false)
        expect(result).toEqual({ repaired: 0, failed: 1 })
    })
})
