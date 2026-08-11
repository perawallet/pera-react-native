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
        metadata: { parentKeyId: 'seed-1' },
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

        expect(regenerate).toHaveBeenCalledWith('seed-1-quantum', 'seed-1')
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
            quantumChild({ id: 'b-quantum', metadata: { parentKeyId: 'b' } }),
        ]

        const result = await repairQuantumMaterial(deps())

        expect(regenerate).toHaveBeenCalledWith('b-quantum', 'b')
        expect(result).toEqual({ repaired: 1, failed: 1 })
    })
})
