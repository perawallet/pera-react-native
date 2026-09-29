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
    getDerivedPublicKeyMock,
    withSecretMock,
    withExportedKeyMock,
    executeWithMnemonicMock,
    loggerWarnMock,
} = vi.hoisted(() => ({
    getDerivedPublicKeyMock: vi.fn(),
    withSecretMock: vi.fn(),
    withExportedKeyMock: vi.fn(),
    executeWithMnemonicMock: vi.fn(),
    loggerWarnMock: vi.fn(),
}))

vi.mock('@algorandfoundation/xhd-wallet-api', () => ({
    BIP32DerivationType: { Khovratovich: 32, Peikert: 9 },
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    encodeAlgorandAddress: (pub: Uint8Array) => `ADDR-${pub[0]}`,
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
        getDerivedPublicKey: getDerivedPublicKeyMock,
        withExportedKey: withExportedKeyMock,
        executeWithMnemonic: executeWithMnemonicMock,
    }),
}))

import {
    BACKUP_ACCESS_DOMAIN,
    entropyToIndices,
} from '@perawallet/wallet-core-kms'
import { useResolveHdSeedForBackup } from '../useResolveHdSeedForBackup'

const ENTROPY = Uint8Array.from({ length: 16 }, (_, i) => i)

const account = {
    id: 'acc-1',
    type: 'hdWallet',
    address: 'ADDR-2',
    keyPairId: 'child-1',
    hdWalletDetails: { account: 3, change: 0, keyIndex: 7, derivationType: 9 },
} as unknown as HDWalletAccount

describe('useResolveHdSeedForBackup', () => {
    let grantedDomain: string

    beforeEach(() => {
        grantedDomain = BACKUP_ACCESS_DOMAIN
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
        // The dedup key is always acc0/idx0/Peikert, never the child's own path.
        expect(getDerivedPublicKeyMock).toHaveBeenCalledWith('seed-1', 0, 0, 9)
        expect(getDerivedPublicKeyMock).toHaveBeenCalledWith('seed-1', 3, 7, 9)
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
