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
    seedReferenceMock,
    deriveHdAccountMock,
    withSecretMock,
    withExportedKeyMock,
    executeWithMnemonicMock,
    loggerWarnMock,
} = vi.hoisted(() => ({
    seedReferenceMock: vi.fn(),
    deriveHdAccountMock: vi.fn(),
    withSecretMock: vi.fn(),
    withExportedKeyMock: vi.fn(),
    executeWithMnemonicMock: vi.fn(),
    loggerWarnMock: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-shared')
    >()),
    logger: { warn: loggerWarnMock },
}))

vi.mock('@perawallet/wallet-core-kms', async importOriginal => ({
    ...(await importOriginal<typeof import('@perawallet/wallet-core-kms')>()),
    withSecret: withSecretMock,
    useKMS: () => ({
        seedIdOf: (childId?: string) =>
            childId === 'child-1' ? 'seed-1' : undefined,
        withExportedKey: withExportedKeyMock,
        executeWithMnemonic: executeWithMnemonicMock,
    }),
}))

import {
    BACKUP_ACCESS_DOMAIN,
    entropyToIndices,
} from '@perawallet/wallet-core-kms'
import { backupChainAdapters } from '../../../chain-adapter'
import { fakeBackupAdapter } from '../../../__tests__/fakeBackupAdapter'
import { useResolveHdSeedForBackup } from '../useResolveHdSeedForBackup'

const ENTROPY = Uint8Array.from({ length: 16 }, (_, i) => i)

const account = {
    id: 'acc-1',
    custody: { kind: 'local', seed: 'bip39', hd: { account: 3, keyIndex: 7 } },
    address: 'ADDR-2',
    keyPairId: 'child-1',
    hdWalletDetails: { account: 3, change: 0, keyIndex: 7, derivationType: 9 },
} as unknown as HDWalletAccount

describe('useResolveHdSeedForBackup', () => {
    let grantedDomain: string

    beforeEach(() => {
        grantedDomain = BACKUP_ACCESS_DOMAIN
        seedReferenceMock.mockReset().mockResolvedValue('ADDR-1')
        deriveHdAccountMock.mockReset().mockResolvedValue({
            keyPairId: 'child-1',
            publicKey: new Uint8Array([2]),
            address: 'ADDR-2',
        })
        backupChainAdapters.reset()
        backupChainAdapters.register(
            fakeBackupAdapter({
                seedReference: seedReferenceMock,
                deriveHdAccount: deriveHdAccountMock,
            }),
        )
        withSecretMock
            .mockReset()
            .mockImplementation(
                async (_id: string, handler: (b: Uint8Array) => unknown) =>
                    handler(ENTROPY),
            )
        withExportedKeyMock
            .mockReset()
            .mockImplementation(
                async (
                    _keyId: string,
                    domain: string,
                    handler: (keyData: { privateKey: Uint8Array }) => unknown,
                ) => {
                    if (domain !== grantedDomain) {
                        throw new Error('KeyAccessError')
                    }
                    return handler({ privateKey: new Uint8Array([0xbe, 0xef]) })
                },
            )
        executeWithMnemonicMock
            .mockReset()
            .mockImplementation(
                async (
                    _keyId: string,
                    domain: string,
                    handler: (indices: Uint16Array) => unknown,
                ) => {
                    if (domain !== grantedDomain) {
                        throw new Error('KeyAccessError')
                    }
                    return handler(
                        await withSecretMock('entropy-1', entropyToIndices),
                    )
                },
            )
        loggerWarnMock.mockReset()
    })

    it('derives the public values once but reads the secrets on every run', async () => {
        const { result } = renderHook(() => useResolveHdSeedForBackup())

        await result.current(account)
        const second = await result.current(account)

        expect(seedReferenceMock).toHaveBeenCalledTimes(1)
        expect(deriveHdAccountMock).toHaveBeenCalledTimes(1)
        expect(withExportedKeyMock).toHaveBeenCalledTimes(2)
        expect(executeWithMnemonicMock).toHaveBeenCalledTimes(2)
        expect(second).toMatchObject({
            seedFirstDerivedAddress: 'ADDR-1',
            publicKeyHex: '02',
        })
    })

    it('does not cache a derivation that failed', async () => {
        seedReferenceMock.mockRejectedValueOnce(new Error('locked'))
        const { result } = renderHook(() => useResolveHdSeedForBackup())

        expect(await result.current(account)).toBeNull()
        expect(await result.current(account)).toMatchObject({
            seedFirstDerivedAddress: 'ADDR-1',
        })
    })

    it('resolves the seed root plus the entropy the mnemonic session hands over', async () => {
        const { result } = renderHook(() => useResolveHdSeedForBackup())

        const resolved = await result.current(account)

        expect(executeWithMnemonicMock).toHaveBeenCalledWith(
            'child-1',
            BACKUP_ACCESS_DOMAIN,
            expect.any(Function),
        )
        expect(resolved).toEqual({
            seedFirstDerivedAddress: 'ADDR-1',
            publicKeyHex: '02',
            seedHex: 'beef',
            entropyHex: '000102030405060708090a0b0c0d0e0f',
        })
        // The dedup key is the chain's seed reference, never the child's own path.
        expect(seedReferenceMock).toHaveBeenCalledWith(
            expect.anything(),
            'seed-1',
        )
        expect(deriveHdAccountMock).toHaveBeenCalledWith(
            expect.anything(),
            'seed-1',
            account.hdWalletDetails,
        )
    })

    it('reads no entropy when the seed ACL does not grant the backup domain', async () => {
        grantedDomain = 'pera.accounts'
        const { result } = renderHook(() => useResolveHdSeedForBackup())

        const resolved = await result.current(account)

        expect(resolved).toBeNull()
        expect(withSecretMock).not.toHaveBeenCalled()
    })

    it('skips the account without exporting the seed when it has no entropy', async () => {
        executeWithMnemonicMock.mockRejectedValue(
            new Error('HD seed is missing its entropy secret'),
        )
        const { result } = renderHook(() => useResolveHdSeedForBackup())

        const resolved = await result.current(account)

        expect(resolved).toBeNull()
        expect(withExportedKeyMock).not.toHaveBeenCalled()
        expect(loggerWarnMock).toHaveBeenCalled()
    })
})
