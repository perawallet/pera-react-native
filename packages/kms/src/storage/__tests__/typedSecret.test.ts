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

// Hoisted shared state — vi.mock factories run before the rest of this module
// is evaluated, so they can only see variables declared via vi.hoisted.
const mocks = vi.hoisted(() => ({
    keys: [] as Array<{ id: string; type: string }>,
    commit: vi.fn(),
    removeKey: vi.fn(),
    exportKey: vi.fn(),
}))

vi.mock('@algorandfoundation/react-native-keystore', () => ({
    commit: mocks.commit,
    removeKey: mocks.removeKey,
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getKeystoreStore: () => ({
        state: { keys: mocks.keys, status: 'idle' },
        setState: vi.fn(),
        subscribe: () => ({ unsubscribe: () => {} }),
    }),
    getProvider: () => ({
        key: {
            store: {
                export: mocks.exportKey,
            },
        },
    }),
}))

import {
    commitTypedSecret,
    hasTypedSecret,
    removeTypedSecret,
    withTypedSecret,
} from '../typedSecret'

describe('typedSecret', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Mutate, don't reassign — the mock factory captures this array by
        // reference.
        mocks.keys.length = 0
    })

    describe('commitTypedSecret', () => {
        test('passes the bytes through as privateKey on a fresh insert', async () => {
            await commitTypedSecret({
                id: 'pera.pinCode',
                type: 'pera.pin-record',
                bytes: new Uint8Array([1, 2, 3, 4]),
            })

            expect(mocks.commit).toHaveBeenCalledTimes(1)
            const arg = mocks.commit.mock.calls[0][0]
            expect(arg.keyData).toMatchObject({
                id: 'pera.pinCode',
                type: 'pera.pin-record',
                algorithm: 'raw',
                format: 'raw',
                extractable: true,
                keyUsages: [],
            })
            expect(Array.from(arg.keyData.privateKey)).toEqual([1, 2, 3, 4])
        })

        test('passes through algorithm, keyUsages, publicKey, metadata when provided', async () => {
            const publicKey = new Uint8Array([9, 9, 9])
            await commitTypedSecret({
                id: 'k',
                type: 'algo25',
                bytes: new Uint8Array([0, 0]),
                algorithm: 'EdDSA',
                keyUsages: ['sign'],
                publicKey,
                metadata: { pera: { createdAt: 'iso' } },
            })

            const arg = mocks.commit.mock.calls[0][0]
            expect(arg.keyData.algorithm).toBe('EdDSA')
            expect(arg.keyData.keyUsages).toEqual(['sign'])
            expect(arg.keyData.publicKey).toBe(publicKey)
            expect(arg.keyData.metadata).toEqual({ pera: { createdAt: 'iso' } })
        })

        test('upserts: removes the existing entry before committing again', async () => {
            mocks.keys.push({ id: 'pera.pinCode', type: 'pera.pin-record' })
            mocks.removeKey.mockImplementationOnce(async () => {
                mocks.keys.length = 0
            })

            await commitTypedSecret({
                id: 'pera.pinCode',
                type: 'pera.pin-record',
                bytes: new Uint8Array([7]),
            })

            expect(mocks.removeKey).toHaveBeenCalledWith(
                expect.objectContaining({ keyId: 'pera.pinCode' }),
            )
            expect(mocks.removeKey.mock.invocationCallOrder[0]).toBeLessThan(
                mocks.commit.mock.invocationCallOrder[0],
            )
        })

        test('skips removeKey when no existing entry', async () => {
            await commitTypedSecret({
                id: 'fresh',
                type: 'pera.pin-record',
                bytes: new Uint8Array([1]),
            })

            expect(mocks.removeKey).not.toHaveBeenCalled()
            expect(mocks.commit).toHaveBeenCalledTimes(1)
        })
    })

    describe('withTypedSecret', () => {
        test('returns null and does not invoke handler when the id is not in the store', async () => {
            const handler = vi.fn()
            const result = await withTypedSecret('missing', handler)
            expect(result).toBeNull()
            expect(handler).not.toHaveBeenCalled()
            expect(mocks.exportKey).not.toHaveBeenCalled()
        })

        test('returns the handler result and zeros the bytes after success', async () => {
            mocks.keys.push({ id: 'pera.pinCode', type: 'pera.pin-record' })
            const bytes = new Uint8Array([1, 2, 3])
            mocks.exportKey.mockResolvedValueOnce({ privateKey: bytes })

            const result = await withTypedSecret('pera.pinCode', b =>
                Array.from(b).reduce((sum, n) => sum + n, 0),
            )

            expect(result).toBe(6)
            expect(Array.from(bytes)).toEqual([0, 0, 0])
        })

        test('zeros the bytes even when the handler throws', async () => {
            mocks.keys.push({ id: 'pera.pinCode', type: 'pera.pin-record' })
            const bytes = new Uint8Array([7, 8, 9])
            mocks.exportKey.mockResolvedValueOnce({ privateKey: bytes })

            await expect(
                withTypedSecret('pera.pinCode', () => {
                    throw new Error('boom')
                }),
            ).rejects.toThrow('boom')

            expect(Array.from(bytes)).toEqual([0, 0, 0])
        })

        test('returns null when the keystore export has no privateKey', async () => {
            mocks.keys.push({ id: 'pera.pinCode', type: 'pera.pin-record' })
            mocks.exportKey.mockResolvedValueOnce({})
            const handler = vi.fn()

            const result = await withTypedSecret('pera.pinCode', handler)

            expect(result).toBeNull()
            expect(handler).not.toHaveBeenCalled()
        })
    })

    describe('hasTypedSecret', () => {
        test('returns true when the id is in the store', () => {
            mocks.keys.push({ id: 'pera.pinCode', type: 'pera.pin-record' })
            expect(hasTypedSecret('pera.pinCode')).toBe(true)
        })

        test('returns false when the id is not in the store', () => {
            expect(hasTypedSecret('missing')).toBe(false)
        })
    })

    describe('removeTypedSecret', () => {
        test('no-ops when the id is not in the store', async () => {
            await removeTypedSecret('missing')
            expect(mocks.removeKey).not.toHaveBeenCalled()
        })

        test('calls removeKey with the store and keyId when present', async () => {
            mocks.keys.push({ id: 'pera.pinCode', type: 'pera.pin-record' })

            await removeTypedSecret('pera.pinCode')

            expect(mocks.removeKey).toHaveBeenCalledWith(
                expect.objectContaining({ keyId: 'pera.pinCode' }),
            )
        })

        test('swallows errors from removeKey (tolerant of races)', async () => {
            mocks.keys.push({ id: 'pera.pinCode', type: 'pera.pin-record' })
            mocks.removeKey.mockRejectedValueOnce(new Error('KeyNotFoundError'))

            await expect(
                removeTypedSecret('pera.pinCode'),
            ).resolves.toBeUndefined()
        })
    })
})
