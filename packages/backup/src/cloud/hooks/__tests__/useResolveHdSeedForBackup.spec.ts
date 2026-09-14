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

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { HDWalletAccount } from '@perawallet/wallet-core-accounts'

const {
    keystoreKeys,
    secretBytes,
    exportedKeyData,
    getDerivedPublicKeyMock,
    withSecretMock,
    loggerWarnMock,
} = vi.hoisted(() => ({
    keystoreKeys: {
        value: [] as { id: string; type: string; metadata?: unknown }[],
    },
    secretBytes: { value: new Uint8Array([0xde, 0xad]) },
    exportedKeyData: {
        value: { id: 'seed-1', privateKey: new Uint8Array([0xbe, 0xef]) } as {
            id: string
            privateKey?: Uint8Array
            metadata?: Record<string, unknown>
        },
    },
    getDerivedPublicKeyMock: vi.fn(),
    withSecretMock: vi.fn(),
    loggerWarnMock: vi.fn(),
}))

vi.mock('@algorandfoundation/xhd-wallet-api', () => ({
    BIP32DerivationType: { Khovratovich: 32, Peikert: 9 },
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    encodeAlgorandAddress: (pub: Uint8Array) => `ADDR-${pub[0]}`,
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    bytesToHex: (bytes: Uint8Array) =>
        Array.from(bytes)
            .map(b => b.toString(16).padStart(2, '0'))
            .join(''),
    logger: { warn: loggerWarnMock },
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    getKeystoreStore: () => ({ state: { keys: keystoreKeys.value } }),
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    // Mirrors the real `entropyChildIdOf`, whose metadata contract is pinned by
    // kms's own utils tests — same approach as migratePasskeys.spec.
    entropyChildIdOf: (
        seedKeyId: string,
        keys: { id: string; type: string; metadata?: unknown }[],
    ) =>
        keys.find(k => {
            const meta = (k.metadata ?? {}) as {
                parentKeyId?: unknown
                entropyKey?: unknown
            }
            return (
                k.type === 'secret-key' &&
                meta.parentKeyId === seedKeyId &&
                meta.entropyKey === true
            )
        })?.id,
    withSecret: withSecretMock,
    useKMS: () => ({
        seedIdOf: (childId?: string) =>
            childId === 'child-1' ? 'seed-1' : undefined,
        getDerivedPublicKey: getDerivedPublicKeyMock,
        withExportedKey: async <T>(
            _keyId: string,
            handler: (keyData: unknown) => T | Promise<T>,
        ) => handler(exportedKeyData.value),
    }),
}))

import { useResolveHdSeedForBackup } from '../useResolveHdSeedForBackup'

const account = {
    id: 'acc-1',
    type: 'hdWallet',
    address: 'ADDR-2',
    keyPairId: 'child-1',
    hdWalletDetails: { account: 3, change: 0, keyIndex: 7, derivationType: 9 },
} as unknown as HDWalletAccount

describe('useResolveHdSeedForBackup', () => {
    beforeEach(() => {
        // The seed's own metadata carries no entropy — `persistHDMasterKey`
        // keeps it in a `secret-key` child, which is what B7 missed.
        keystoreKeys.value = [
            { id: 'seed-1', type: 'hd-root-key', metadata: {} },
            {
                id: 'entropy-1',
                type: 'secret-key',
                metadata: { parentKeyId: 'seed-1', entropyKey: true },
            },
        ]
        exportedKeyData.value = {
            id: 'seed-1',
            privateKey: new Uint8Array([0xbe, 0xef]),
            metadata: {},
        }
        getDerivedPublicKeyMock
            .mockReset()
            .mockImplementation(
                async (_seedId: string, acc: number, idx: number) =>
                    new Uint8Array([acc === 0 && idx === 0 ? 1 : 2]),
            )
        withSecretMock
            .mockReset()
            .mockImplementation(
                async (_id: string, handler: (b: Uint8Array) => unknown) =>
                    handler(secretBytes.value),
            )
        loggerWarnMock.mockReset()
    })

    it('resolves the seed root plus the entropy held in its secret-key child', async () => {
        const { result } = renderHook(() => useResolveHdSeedForBackup())

        const resolved = await result.current(account)

        expect(withSecretMock).toHaveBeenCalledWith(
            'entropy-1',
            expect.any(Function),
        )
        expect(resolved).toEqual({
            seedFirstDerivedAddress: 'ADDR-1',
            publicKeyHex: '02',
            seedHex: 'beef',
            entropyHex: 'dead',
        })
        // The dedup key is always acc0/idx0/Peikert, never the child's own path.
        expect(getDerivedPublicKeyMock).toHaveBeenCalledWith('seed-1', 0, 0, 9)
        expect(getDerivedPublicKeyMock).toHaveBeenCalledWith('seed-1', 3, 7, 9)
    })

    it('skips the account and warns when the seed has no entropy child', async () => {
        keystoreKeys.value = [
            { id: 'seed-1', type: 'hd-root-key', metadata: {} },
        ]
        const { result } = renderHook(() => useResolveHdSeedForBackup())

        const resolved = await result.current(account)

        expect(resolved).toBeNull()
        expect(withSecretMock).not.toHaveBeenCalled()
        expect(loggerWarnMock).toHaveBeenCalledWith(
            'useResolveHdSeedForBackup: seed has no entropy child',
            { seedKeyId: 'seed-1' },
        )
    })
})
