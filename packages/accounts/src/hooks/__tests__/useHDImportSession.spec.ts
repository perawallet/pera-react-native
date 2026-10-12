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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHDImportSession } from '../useHDImportSession'
import { useHDImportSessionStore } from '../../import-session'
import { useAccountsStore } from '../../store'
import { HDImportSessionNotFoundError } from '../../errors'
import type { LocalAccount } from '../../models'
import { buildAccount, addressOn } from '../../credentials'
import {
    fakeAccountsChain,
    TESTNET_SCOPE,
} from '../../__tests__/fakeAccountsChain'

const kmsMock = vi.hoisted(() => ({
    persistHDMasterKey: vi.fn(),
    removeKeyAndChildren: vi.fn().mockResolvedValue(undefined),
}))
const prepareMock = vi.hoisted(() => vi.fn())

vi.mock('@perawallet/wallet-core-kms', async importOriginal => ({
    ...(await importOriginal<typeof import('@perawallet/wallet-core-kms')>()),
    useKMS: () => kmsMock,
    prepareHDMasterKey: prepareMock,
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...actual,
        generateOrderedUniqueId: vi.fn(() => 'gen-id'),
    }
})

const INDICES = new Uint16Array(24)

const discovered = (): LocalAccount =>
    buildAccount({
        id: 'discovered-1',
        custody: {
            kind: 'local',
            seed: 'bip39',
            hd: { account: 1, keyIndex: 0 },
        },
        chainId: TESTNET_SCOPE.chainId,
        chains: {
            [TESTNET_SCOPE.chainId]: {
                address: 'ADDR-A',
                keyPairId: 'w-1-acc1-idx0-dt9',
            },
        },
    })

describe('useHDImportSession', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useHDImportSessionStore.getState().resetState()
        useAccountsStore.setState({ accounts: [] })
        prepareMock.mockResolvedValue({
            keyId: 'w-1',
            rootKey: new Uint8Array(96).fill(7),
            entropy: new Uint8Array(32).fill(3),
            mnemonic: 'one two three',
        })
        kmsMock.persistHDMasterKey.mockResolvedValue({
            seedKey: {
                id: 'w-1',
                type: 'seed',
                algorithm: 'raw',
                extractable: true,
                metadata: {},
            },
        })
    })

    test('prepareImport stores rootKey/entropy in the session store', async () => {
        const { result } = renderHook(() => useHDImportSession(TESTNET_SCOPE))
        let prep: any
        await act(async () => {
            prep = await result.current.prepareImport({
                mnemonicIndices: INDICES,
            })
        })
        expect(prep.walletKeyId).toBe('w-1')
        expect(prepareMock).toHaveBeenCalledWith({ mnemonicIndices: INDICES })
        expect(useHDImportSessionStore.getState().pending?.walletKeyId).toBe(
            'w-1',
        )
    })

    test('cancelImport clears the session', async () => {
        const { result } = renderHook(() => useHDImportSession(TESTNET_SCOPE))
        await act(async () => {
            await result.current.prepareImport({ mnemonicIndices: INDICES })
        })
        act(() => result.current.cancelImport())
        expect(useHDImportSessionStore.getState().pending).toBeNull()
    })

    test('commitImport persists the keystore root and saves selected accounts', async () => {
        const { result } = renderHook(() => useHDImportSession(TESTNET_SCOPE))
        await act(async () => {
            await result.current.prepareImport({ mnemonicIndices: INDICES })
        })

        const selected = [discovered()]

        let saved: any
        await act(async () => {
            saved = await result.current.commitImport({
                walletKeyId: 'w-1',
                selectedAccounts: selected,
            })
        })

        expect(kmsMock.persistHDMasterKey).toHaveBeenCalledWith(
            expect.objectContaining({ keyId: 'w-1' }),
        )
        expect(
            fakeAccountsChain().derivation.deriveAccount,
        ).toHaveBeenCalledWith(expect.anything(), 'w-1', 1, 0, {
            scheme: 'ed25519',
            networkId: 'testnet',
        })
        expect(saved).toHaveLength(1)
        expect(addressOn(saved[0], TESTNET_SCOPE)).toBe('ADDR-A')
        expect(useAccountsStore.getState().accounts).toHaveLength(1)
        expect(useHDImportSessionStore.getState().pending).toBeNull()
    })

    test('commitImport removes the persisted seed and keeps the session when a child derive rejects', async () => {
        vi.mocked(
            fakeAccountsChain().derivation.deriveAccount,
        ).mockRejectedValueOnce(new Error('derive failed'))
        const { result } = renderHook(() => useHDImportSession(TESTNET_SCOPE))
        await act(async () => {
            await result.current.prepareImport({ mnemonicIndices: INDICES })
        })

        await act(async () => {
            await expect(
                result.current.commitImport({
                    walletKeyId: 'w-1',
                    selectedAccounts: [discovered()],
                }),
            ).rejects.toThrow('derive failed')
        })

        expect(kmsMock.removeKeyAndChildren).toHaveBeenCalledWith('w-1')
        expect(useAccountsStore.getState().accounts).toHaveLength(0)
    })

    test('commitImport throws and keeps session pending if walletKeyId mismatches', async () => {
        const { result } = renderHook(() => useHDImportSession(TESTNET_SCOPE))
        await act(async () => {
            await result.current.prepareImport({ mnemonicIndices: INDICES })
        })

        await act(async () => {
            await expect(
                result.current.commitImport({
                    walletKeyId: 'wrong',
                    selectedAccounts: [],
                }),
            ).rejects.toThrow(HDImportSessionNotFoundError)
        })
        expect(useHDImportSessionStore.getState().pending?.walletKeyId).toBe(
            'w-1',
        )
        expect(kmsMock.persistHDMasterKey).not.toHaveBeenCalled()
    })

    test('discoverImportAccounts scans the scope with the session root key', async () => {
        const { adapter } = fakeAccountsChain()
        const { result } = renderHook(() => useHDImportSession(TESTNET_SCOPE))
        await act(async () => {
            await result.current.prepareImport({ mnemonicIndices: INDICES })
        })

        let found: LocalAccount[] = []
        await act(async () => {
            found = await result.current.discoverImportAccounts({
                walletKeyId: 'w-1',
            })
        })

        expect(adapter.createPublicKeyGetter).toHaveBeenCalledWith(
            new Uint8Array(96).fill(7),
        )
        expect(adapter.checkActivity).toHaveBeenCalledWith(
            expect.any(Array),
            TESTNET_SCOPE,
        )
        // Nothing is active, so discovery falls back to the first account.
        expect(found.map(account => account.custody)).toEqual([
            { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 0 } },
        ])
    })

    test('discoverImportAccounts refuses a wallet the session did not prepare', async () => {
        const { result } = renderHook(() => useHDImportSession(TESTNET_SCOPE))

        await expect(
            result.current.discoverImportAccounts({ walletKeyId: 'w-1' }),
        ).rejects.toThrow(HDImportSessionNotFoundError)
    })
})
