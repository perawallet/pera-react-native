/*
 Copyright 2022-2025 Pera Wallet, LDA
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

// Mock dependencies that rely on native modules or complex setups
vi.mock('./storage/state.ts', () => ({
    commit: vi.fn().mockResolvedValue(undefined),
    storage: {
        remove: vi.fn(),
        clearAll: vi.fn(),
    },
}))

vi.mock('@algorandfoundation/wallet-provider', () => ({
    generateId: vi.fn().mockReturnValue('test-id'),
    clearBuffer: vi.fn(),
}))

import type { KeyStoreState } from '@algorandfoundation/keystore'
import { Store } from '@tanstack/store'
// Import the functions AFTER mocking
import { importKey, importSeed, parsePath } from './store.ts'

describe('react-native-keystore store.ts logic', () => {
    describe('parsePath', () => {
        it('should parse a standard BIP44 path', () => {
            const path = "m/44'/283'/0'/0/0"
            const result = parsePath(path)
            expect(result).toEqual([
                0x80000000 + 44,
                0x80000000 + 283,
                0x80000000 + 0,
                0,
                0,
            ])
        })

        it("should handle paths without 'm/' prefix", () => {
            const path = "44'/283'/0'/0/1"
            const result = parsePath(path)
            expect(result).toEqual([
                0x80000000 + 44,
                0x80000000 + 283,
                0x80000000 + 0,
                0,
                1,
            ])
        })

        it('should handle mixed hardened and non-hardened parts', () => {
            const path = "m/44'/283/0'/1/2"
            const result = parsePath(path)
            expect(result).toEqual([0x80000000 + 44, 283, 0x80000000 + 0, 1, 2])
        })
    })

    describe('importSeed', () => {
        const store = new Store<KeyStoreState>({ keys: [], status: 'idle' })

        it('should throw an error for mnemonic import as it is not implemented', async () => {
            const mnemonic =
                'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
            await expect(importSeed({ store, seed: mnemonic })).rejects.toThrow(
                'Mnemonic import is not implemented yet',
            )
        })

        it('should import a raw Uint8Array seed', async () => {
            const rawSeed = new Uint8Array(64).fill(1)
            const id = await importSeed({
                store,
                seed: rawSeed,
                name: 'Raw Seed',
            })

            expect(id).toBe('test-id')
            const { commit } = await import('./storage/state.ts')
            expect(commit).toHaveBeenCalledWith(
                expect.objectContaining({
                    keyData: expect.objectContaining({
                        type: 'hd-seed',
                        privateKey: rawSeed,
                        name: 'Raw Seed',
                    }),
                }),
            )
        })
    })

    describe('importKey', () => {
        const store = new Store<KeyStoreState>({ keys: [], status: 'idle' })

        it('should throw for raw Uint8Array as first argument', async () => {
            const raw = new Uint8Array(32)
            await expect(importKey({ store, keyData: raw })).rejects.toThrow(
                'Importing raw or encoded keys is not currently supported. Use KeyData instead.',
            )
        })

        it('should throw for string as first argument', async () => {
            const mnemonic =
                'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
            await expect(
                importKey({ store, keyData: mnemonic }),
            ).rejects.toThrow(
                'Importing raw or encoded keys is not currently supported. Use KeyData instead.',
            )
        })

        it('should import a SeedData object with Uint8Array privateKey', async () => {
            const rawSeed = new Uint8Array(64).fill(1)
            const keyData = {
                type: 'hd-seed' as const,
                algorithm: 'raw' as const,
                format: 'bytes' as const,
                extractable: true,
                keyUsages: ['deriveKey', 'deriveBits'] as any,
                privateKey: rawSeed,
            }
            const id = await importKey({ store, keyData })
            expect(id).toBe('test-id')
        })
    })
})
