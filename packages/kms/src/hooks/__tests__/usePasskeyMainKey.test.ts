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
import { renderHook } from '@testing-library/react'
import type { Key } from '@algorandfoundation/keystore-core'

const mockKeyStoreGenerate = vi.fn()
vi.mock('../useKMSServices', () => ({
    useKMSService: () => ({
        keyStore: {
            generate: (...args: unknown[]) => mockKeyStoreGenerate(...args),
        },
    }),
}))

const mockReactiveKeys: Key[] = []
vi.mock('@perawallet/wallet-extension-provider', async () => ({
    ...(await vi.importActual<object>(
        '../../../../../extensions/provider/src/keystore/passkeyMainKey',
    )),
    getKeystoreStore: () => ({
        get state() {
            return { keys: mockReactiveKeys, status: 'idle' as const }
        },
    }),
}))

import {
    findPasskeyMainKey,
    passkeyMainKeyId,
    usePasskeyMainKey,
} from '../usePasskeyMainKey'
import { KeyManagementError } from '../../errors'

const seedKey = (id: string): Key =>
    ({
        id,
        type: 'hd-root-key',
        algorithm: 'raw',
        extractable: true,
        metadata: { scheme: 'bip39' },
    }) as unknown as Key

const entropyChild = (id: string, parentKeyId: string): Key =>
    ({
        id,
        type: 'secret-key',
        algorithm: 'raw',
        extractable: false,
        metadata: { parentKeyId, entropyKey: true },
    }) as unknown as Key

const mainKey = (id: string, parentKeyId: string): Key =>
    ({
        id,
        type: 'hd-root-key',
        algorithm: 'P256',
        extractable: false,
        metadata: { scheme: 'pbkdf2-p256', parentKeyId },
    }) as unknown as Key

describe('usePasskeyMainKey', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockReactiveKeys.length = 0
        mockKeyStoreGenerate.mockResolvedValue('generated-id')
    })

    test('mints a pbkdf2-p256 root parented on the entropy child', async () => {
        mockReactiveKeys.push(seedKey('hd-1'), entropyChild('ent-1', 'hd-1'))
        const { result } = renderHook(() => usePasskeyMainKey())

        await result.current.ensurePasskeyMainKey('hd-1')

        expect(mockKeyStoreGenerate).toHaveBeenCalledTimes(1)
        expect(mockKeyStoreGenerate).toHaveBeenCalledWith({
            type: 'hd-root-key',
            // Without this the same `hd-root-key` type routes to the XHD
            // `generateHDRoot` and the wallet gets a second BIP32-Ed25519 root.
            algorithm: 'P256',
            extractable: false,
            keyUsages: ['deriveBits', 'deriveKey'],
            params: {
                // The entropy child, not `hd-1` — `generateDP256Main` PBKDF2s
                // the parent's stored bytes as-is.
                parentKeyId: 'ent-1',
                id: passkeyMainKeyId('hd-1'),
            },
        })
    })

    test('returns the existing main key rather than minting a second', async () => {
        // A second main key means new credentials derive from a different
        // secret than the ones already on the device.
        mockReactiveKeys.push(
            seedKey('hd-1'),
            entropyChild('ent-1', 'hd-1'),
            mainKey('already-here', 'ent-1'),
        )
        const { result } = renderHook(() => usePasskeyMainKey())

        const id = await result.current.ensurePasskeyMainKey('hd-1')

        expect(id).toBe('already-here')
        expect(mockKeyStoreGenerate).not.toHaveBeenCalled()
    })

    test('derives the same main key id from the same seed', async () => {
        mockReactiveKeys.push(seedKey('hd-1'), entropyChild('ent-1', 'hd-1'))
        const { result } = renderHook(() => usePasskeyMainKey())

        await result.current.ensurePasskeyMainKey('hd-1')
        mockReactiveKeys.length = 0
        mockReactiveKeys.push(seedKey('hd-1'), entropyChild('ent-9', 'hd-1'))
        await result.current.ensurePasskeyMainKey('hd-1')

        const ids = mockKeyStoreGenerate.mock.calls.map(
            ([options]) => (options as { params: { id: string } }).params.id,
        )
        expect(ids).toEqual([
            passkeyMainKeyId('hd-1'),
            passkeyMainKeyId('hd-1'),
        ])
    })

    test('throws rather than minting from the wrong parent when the seed has no entropy child', async () => {
        mockReactiveKeys.push(seedKey('hd-1'))
        const { result } = renderHook(() => usePasskeyMainKey())

        await expect(
            result.current.ensurePasskeyMainKey('hd-1'),
        ).rejects.toBeInstanceOf(KeyManagementError)
        expect(mockKeyStoreGenerate).not.toHaveBeenCalled()
    })

    describe('findPasskeyMainKey', () => {
        test('ignores an hd-root-key that is the XHD root rather than the main key', () => {
            mockReactiveKeys.push(
                seedKey('hd-1'),
                entropyChild('ent-1', 'hd-1'),
            )

            expect(findPasskeyMainKey()).toBeNull()
        })

        test('finds the main key among the wallet roots', () => {
            mockReactiveKeys.push(seedKey('hd-1'), mainKey('main-1', 'ent-1'))

            expect(findPasskeyMainKey()?.id).toBe('main-1')
        })
    })
})
