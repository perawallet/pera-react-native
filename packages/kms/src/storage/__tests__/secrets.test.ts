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

import { describe, test, expect, vi, beforeEach } from 'vitest'

// Hoisted shared state — vi.mock factories run before the rest of this
// module is evaluated, so they can only see variables declared via
// vi.hoisted.
const mocks = vi.hoisted(() => ({
    keys: [] as Array<{ id: string; type: string }>,
    generate: vi.fn(),
    remove: vi.fn(),
    exportKey: vi.fn(),
    lastValueSnapshot: null as Uint8Array | null,
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getKeystoreStore: () => ({
        get state() {
            return { keys: mocks.keys, status: 'idle' as const }
        },
        setState: (
            updater: (prev: {
                keys: Array<{ id: string; type: string }>
                status: 'idle'
            }) => {
                keys: Array<{ id: string; type: string }>
                status: 'idle'
            },
        ) => {
            const next = updater({ keys: mocks.keys, status: 'idle' })
            mocks.keys.length = 0
            mocks.keys.push(...next.keys)
        },
        subscribe: () => ({ unsubscribe: () => {} }),
    }),
    getProvider: () => ({
        key: {
            store: {
                generate: mocks.generate,
                remove: mocks.remove,
                export: mocks.exportKey,
            },
        },
    }),
}))

import { commitSecret, hasSecret, removeSecret, withSecret } from '../secrets'

describe('secrets', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Mutate, don't reassign — the mock factory captures this array by
        // reference.
        mocks.keys.length = 0
        // Default `generate` simulates the platform keystore: prepends a
        // secret-key entry to the reactive `keys` array without dedupe so
        // the upsert tests can exercise the cleanup that `commitSecret`
        // performs.
        mocks.generate.mockImplementation(
            async (options: {
                type: string
                params?: {
                    id?: string
                    params?: { value?: Uint8Array }
                }
            }) => {
                const id = options.params?.id ?? 'generated-id'
                mocks.keys.unshift({ id, type: options.type })
                // Snapshot the secret bytes synchronously so the test
                // can inspect what was passed in. `commitSecret` zeros
                // its defensive valueCopy in a finally once we resolve,
                // so the live reference would otherwise be all zeros by
                // the time the assertion runs.
                const value = options.params?.params?.value
                if (value instanceof Uint8Array) {
                    mocks.lastValueSnapshot = new Uint8Array(value)
                }
                return id
            },
        )
    })

    describe('commitSecret', () => {
        test('writes a canonical secret-key entry via keyStore.generate with nested params.value', async () => {
            await commitSecret({
                id: 'pera.pinCode',
                bytes: new Uint8Array([1, 2, 3, 4]),
            })

            expect(mocks.generate).toHaveBeenCalledTimes(1)
            const arg = mocks.generate.mock.calls[0][0]
            expect(arg).toMatchObject({
                type: 'secret-key',
                algorithm: 'raw',
                extractable: true,
                keyUsages: [],
            })
            // The id is at `params.id` (read by rn-keystore as the
            // top-level keyData.id). The actual secret bytes nest one
            // level deeper at `params.params.value` because
            // `generateSecretKey` in @algorandfoundation/keystore reads
            // `keyData.metadata.params` for the value, and rn-keystore
            // hangs our params under metadata via `metadata: {...params}`.
            expect(arg.params.id).toBe('pera.pinCode')
            // Read the snapshot stashed by the mock at call time —
            // commitSecret zeros its defensive copy after generate
            // resolves, so `arg.params.params.value` is now all zeros.
            expect(Array.from(mocks.lastValueSnapshot!)).toEqual([1, 2, 3, 4])
        })

        test('passes through metadata via params.params.metadata when provided', async () => {
            await commitSecret({
                id: 'k',
                bytes: new Uint8Array([0, 0]),
                metadata: { createdAt: 'iso' },
            })

            const arg = mocks.generate.mock.calls[0][0]
            expect(arg.params.params.metadata).toEqual({ createdAt: 'iso' })
        })
    })

    describe('commitSecret upsert / error paths', () => {
        test('upserts atomically: generates first, then dedupes the reactive store', async () => {
            mocks.keys.push({ id: 'pera.pinCode', type: 'secret-key' })

            await commitSecret({
                id: 'pera.pinCode',
                bytes: new Uint8Array([7]),
            })

            // generate() ran (and our mock impl prepended), but remove did
            // NOT — we never deleted the prior entry from MMKV before
            // writing the new one. The MMKV layer overwrites under the
            // same id, and the reactive store is left with a single
            // deduplicated entry.
            expect(mocks.generate).toHaveBeenCalledTimes(1)
            expect(mocks.remove).not.toHaveBeenCalled()
            expect(mocks.keys).toHaveLength(1)
            expect(mocks.keys[0]).toEqual({
                id: 'pera.pinCode',
                type: 'secret-key',
            })
        })

        test('preserves the existing entry when generate() throws', async () => {
            const original = { id: 'pera.pinCode', type: 'secret-key' }
            mocks.keys.push(original)
            mocks.generate.mockImplementationOnce(async () => {
                throw new Error('boom')
            })

            await expect(
                commitSecret({
                    id: 'pera.pinCode',
                    bytes: new Uint8Array([7]),
                }),
            ).rejects.toThrow('boom')

            // The previous entry is still there — we did not delete first,
            // so a failed generate is safe.
            expect(mocks.remove).not.toHaveBeenCalled()
            expect(mocks.keys).toEqual([original])
        })

        test('fresh insert (no existing entry) generates without dedupe work', async () => {
            await commitSecret({
                id: 'fresh',
                bytes: new Uint8Array([1]),
            })

            expect(mocks.remove).not.toHaveBeenCalled()
            expect(mocks.generate).toHaveBeenCalledTimes(1)
            expect(mocks.keys).toHaveLength(1)
            expect(mocks.keys[0].id).toBe('fresh')
        })
    })

    describe('withSecret', () => {
        test('returns null and does not invoke handler when the id is not in the store', async () => {
            const handler = vi.fn()
            const result = await withSecret('missing', handler)
            expect(result).toBeNull()
            expect(handler).not.toHaveBeenCalled()
            expect(mocks.exportKey).not.toHaveBeenCalled()
        })

        test('returns the handler result and zeros the bytes after success', async () => {
            mocks.keys.push({ id: 'pera.pinCode', type: 'secret-key' })
            const bytes = new Uint8Array([1, 2, 3])
            mocks.exportKey.mockResolvedValueOnce({ privateKey: bytes })

            const result = await withSecret('pera.pinCode', b =>
                Array.from(b).reduce((sum, n) => sum + n, 0),
            )

            expect(result).toBe(6)
            expect(Array.from(bytes)).toEqual([0, 0, 0])
        })

        test('zeros the bytes even when the handler throws', async () => {
            mocks.keys.push({ id: 'pera.pinCode', type: 'secret-key' })
            const bytes = new Uint8Array([7, 8, 9])
            mocks.exportKey.mockResolvedValueOnce({ privateKey: bytes })

            await expect(
                withSecret('pera.pinCode', () => {
                    throw new Error('boom')
                }),
            ).rejects.toThrow('boom')

            expect(Array.from(bytes)).toEqual([0, 0, 0])
        })

        test('returns null when the keystore export has no privateKey', async () => {
            mocks.keys.push({ id: 'pera.pinCode', type: 'secret-key' })
            mocks.exportKey.mockResolvedValueOnce({})
            const handler = vi.fn()

            const result = await withSecret('pera.pinCode', handler)

            expect(result).toBeNull()
            expect(handler).not.toHaveBeenCalled()
        })
    })

    describe('hasSecret', () => {
        test('returns true when the id is in the store', () => {
            mocks.keys.push({ id: 'pera.pinCode', type: 'secret-key' })
            expect(hasSecret('pera.pinCode')).toBe(true)
        })

        test('returns false when the id is not in the store', () => {
            expect(hasSecret('missing')).toBe(false)
        })
    })

    describe('removeSecret', () => {
        test('no-ops when the id is not in the store', async () => {
            await removeSecret('missing')
            expect(mocks.remove).not.toHaveBeenCalled()
        })

        test('calls keyStore.remove with the id when present', async () => {
            mocks.keys.push({ id: 'pera.pinCode', type: 'secret-key' })

            await removeSecret('pera.pinCode')

            expect(mocks.remove).toHaveBeenCalledWith('pera.pinCode')
        })

        test('swallows errors from keyStore.remove (tolerant of races)', async () => {
            mocks.keys.push({ id: 'pera.pinCode', type: 'secret-key' })
            mocks.remove.mockRejectedValueOnce(new Error('KeyNotFoundError'))

            await expect(removeSecret('pera.pinCode')).resolves.toBeUndefined()
        })
    })
})
