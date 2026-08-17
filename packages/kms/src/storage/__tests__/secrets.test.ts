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

import { describe, test, expect, vi, beforeEach } from 'vitest'

// Hoisted shared state — vi.mock factories run before the rest of this
// module is evaluated, so they can only see variables declared via
// vi.hoisted.
const mocks = vi.hoisted(() => ({
    keys: [] as Array<{ id: string; type: string }>,
    generate: vi.fn(),
    remove: vi.fn(),
    exportKey: vi.fn(),
    secretsPut: vi.fn(),
    secretsGet: vi.fn(),
    // Swapped to undefined by the "backend without secrets" test.
    secrets: null as unknown,
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
                get secrets() {
                    return mocks.secrets
                },
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
        mocks.secrets = { put: mocks.secretsPut, get: mocks.secretsGet }
        // Mirrors the platform keystore: records a secret-key entry in the
        // reactive `keys` array without dedupe, so the upsert tests can
        // exercise the cleanup `commitSecret` performs.
        mocks.secretsPut.mockImplementation(
            async (
                value: Uint8Array,
                options?: { id?: string; metadata?: Record<string, unknown> },
            ) => {
                const id = options?.id ?? 'generated-id'
                mocks.keys.unshift({ id, type: 'secret-key' })
                // Snapshot synchronously: `commitSecret` zeros its defensive
                // copy in a finally once this resolves, so the live reference
                // would be all zeros by the time an assertion reads it.
                mocks.lastValueSnapshot = new Uint8Array(value)
                return id
            },
        )
    })

    describe('commitSecret', () => {
        test('writes the secret through the keystore secrets API', async () => {
            await commitSecret({
                id: 'pera.pinCode',
                bytes: new Uint8Array([1, 2, 3, 4]),
            })

            expect(mocks.secretsPut).toHaveBeenCalledTimes(1)
            const [, options] = mocks.secretsPut.mock.calls[0]
            expect(options).toEqual({ id: 'pera.pinCode' })
            expect(Array.from(mocks.lastValueSnapshot!)).toEqual([1, 2, 3, 4])
        })

        test('does not route secrets through generate', async () => {
            await commitSecret({
                id: 'pera.pinCode',
                bytes: new Uint8Array([1]),
            })

            // `generate` has no `secret-key` branch in canary.14: it falls
            // through to the host key path and throws "Unrecognized algorithm
            // name" on `algorithm: 'raw'`.
            expect(mocks.generate).not.toHaveBeenCalled()
        })

        test('passes metadata through to the secrets entry', async () => {
            await commitSecret({
                id: 'k',
                bytes: new Uint8Array([0, 0]),
                metadata: { createdAt: 'iso' },
            })

            const [, options] = mocks.secretsPut.mock.calls[0]
            expect(options).toEqual({
                id: 'k',
                metadata: { createdAt: 'iso' },
            })
        })

        test('throws when the backend does not implement secrets', async () => {
            mocks.secrets = undefined

            await expect(
                commitSecret({ id: 'k', bytes: new Uint8Array([1]) }),
            ).rejects.toThrow('Keystore backend does not implement secrets')
        })
    })

    describe('commitSecret upsert / error paths', () => {
        test('upserts atomically: writes first, then dedupes the reactive store', async () => {
            mocks.keys.push({ id: 'pera.pinCode', type: 'secret-key' })

            await commitSecret({
                id: 'pera.pinCode',
                bytes: new Uint8Array([7]),
            })

            // The write ran (and our mock prepended), but remove did NOT — we
            // never delete the prior entry before writing the new one. MMKV
            // overwrites under the same id and the reactive store is left with
            // a single deduplicated entry.
            expect(mocks.secretsPut).toHaveBeenCalledTimes(1)
            expect(mocks.remove).not.toHaveBeenCalled()
            expect(mocks.keys).toHaveLength(1)
            expect(mocks.keys[0]).toEqual({
                id: 'pera.pinCode',
                type: 'secret-key',
            })
        })

        test('preserves the existing entry when the write throws', async () => {
            const original = { id: 'pera.pinCode', type: 'secret-key' }
            mocks.keys.push(original)
            mocks.secretsPut.mockImplementationOnce(async () => {
                throw new Error('boom')
            })

            await expect(
                commitSecret({
                    id: 'pera.pinCode',
                    bytes: new Uint8Array([7]),
                }),
            ).rejects.toThrow('boom')

            expect(mocks.remove).not.toHaveBeenCalled()
            expect(mocks.keys).toEqual([original])
        })

        test('fresh insert (no existing entry) writes without dedupe work', async () => {
            await commitSecret({ id: 'fresh', bytes: new Uint8Array([1]) })

            expect(mocks.remove).not.toHaveBeenCalled()
            expect(mocks.secretsPut).toHaveBeenCalledTimes(1)
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
            expect(mocks.secretsGet).not.toHaveBeenCalled()
        })

        test('reads the material through the secrets API, not export', async () => {
            mocks.keys.push({ id: 'pera.pinCode', type: 'secret-key' })
            mocks.secretsGet.mockResolvedValueOnce(new Uint8Array([1, 2, 3]))

            const result = await withSecret('pera.pinCode', b =>
                Array.from(b).reduce((sum, n) => sum + n, 0),
            )

            expect(result).toBe(6)
            expect(mocks.secretsGet).toHaveBeenCalledWith('pera.pinCode')
            // canary.14's `export` returns public metadata only — reading a
            // secret through it silently yields undefined material.
            expect(mocks.exportKey).not.toHaveBeenCalled()
        })

        test('zeros the bytes after the handler succeeds', async () => {
            mocks.keys.push({ id: 'pera.pinCode', type: 'secret-key' })
            const bytes = new Uint8Array([1, 2, 3])
            mocks.secretsGet.mockResolvedValueOnce(bytes)

            await withSecret('pera.pinCode', () => 'done')

            expect(Array.from(bytes)).toEqual([0, 0, 0])
        })

        test('zeros the bytes even when the handler throws', async () => {
            mocks.keys.push({ id: 'pera.pinCode', type: 'secret-key' })
            const bytes = new Uint8Array([7, 8, 9])
            mocks.secretsGet.mockResolvedValueOnce(bytes)

            await expect(
                withSecret('pera.pinCode', () => {
                    throw new Error('boom')
                }),
            ).rejects.toThrow('boom')

            expect(Array.from(bytes)).toEqual([0, 0, 0])
        })

        test('returns null when the secret holds no bytes', async () => {
            mocks.keys.push({ id: 'pera.pinCode', type: 'secret-key' })
            mocks.secretsGet.mockResolvedValueOnce(undefined)
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
