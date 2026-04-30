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
import { renderHook } from '@testing-library/react'
import type { WalletAccount } from '@perawallet/wallet-core-accounts'

const mockGetKeyOrThrow = vi.fn()
const mockWithHDSession = vi.fn()
const mockWithAlgo25Session = vi.fn()
let mockAccounts: WalletAccount[] = []

vi.mock('@perawallet/wallet-core-kms', () => ({
    useKMS: () => ({
        getKeyOrThrow: (...args: unknown[]) => mockGetKeyOrThrow(...args),
        withHDSession: (...args: unknown[]) => mockWithHDSession(...args),
        withAlgo25Session: (...args: unknown[]) =>
            mockWithAlgo25Session(...args),
    }),
}))

const mockIsHDWalletAccount = vi.fn()
const mockIsAlgo25Account = vi.fn()
const mockIsHardwareWalletAccount = vi.fn()

vi.mock('@perawallet/wallet-core-accounts', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-accounts',
    )
    return {
        ...actual,
        useAccountsStore: (selector: (state: unknown) => unknown) =>
            selector({ accounts: mockAccounts }),
        isHDWalletAccount: (acc: WalletAccount) => mockIsHDWalletAccount(acc),
        isAlgo25Account: (acc: WalletAccount) => mockIsAlgo25Account(acc),
        isHardwareWalletAccount: (acc: WalletAccount) =>
            mockIsHardwareWalletAccount(acc),
    }
})

const encodeTransactionMock = vi.fn()

vi.mock('@perawallet/wallet-core-blockchain', async () => {
    const actual = await vi.importActual<object>(
        '@perawallet/wallet-core-blockchain',
    )
    return {
        ...actual,
        useTransactionEncoder: () => ({
            encodeTransaction: encodeTransactionMock,
        }),
        encodeAlgorandAddress: () => 'SENDER_PK',
        Address: { fromString: (addr: string) => ({ _addr: addr }) },
    }
})

import { useLocalKeyTransactionSigner } from '../useLocalKeyTransactionSigner'

const hdAccount = {
    address: 'HD_ADDR',
    keyPairId: 'key-hd',
    type: 'hdWallet',
    hdWalletDetails: {
        account: 0,
        change: 0,
        keyIndex: 1,
        derivationType: 9,
    },
} as unknown as WalletAccount

const algo25Account = {
    address: 'ALGO25_ADDR',
    keyPairId: 'key-algo25',
    type: 'algo25',
} as unknown as WalletAccount

const rekeyedAccount = {
    address: 'REKEYED_ADDR',
    type: 'algo25',
    rekeyAddress: 'ALGO25_ADDR',
} as unknown as WalletAccount

const unsupportedAccount = {
    address: 'UNKNOWN_ADDR',
    type: 'watch',
} as unknown as WalletAccount

const hardwareAccount = {
    address: 'LEDGER_ADDR',
    type: 'hardware',
    hardwareDetails: {
        manufacturer: 'ledger',
        deviceId: 'device-1',
        deviceName: 'Ledger Nano X',
        accountIndex: 0,
        transportType: 'ble',
    },
} as unknown as WalletAccount

const makeTxn = (senderAddr: string) =>
    ({
        sender: {
            publicKey: new Uint8Array(32),
            toString: () => senderAddr,
        },
    }) as never

describe('useLocalKeyTransactionSigner', () => {
    beforeEach(() => {
        mockGetKeyOrThrow.mockReset()
        mockWithHDSession.mockReset()
        mockWithAlgo25Session.mockReset()
        mockIsHDWalletAccount.mockReset().mockReturnValue(false)
        mockIsAlgo25Account.mockReset().mockReturnValue(false)
        mockIsHardwareWalletAccount.mockReset().mockReturnValue(false)
        encodeTransactionMock.mockReset().mockReturnValue(new Uint8Array([1]))
        mockAccounts = []
    })

    test('signs HD wallet transactions via withHDSession', async () => {
        mockAccounts = [hdAccount]
        mockIsHDWalletAccount.mockImplementation(acc => acc.type === 'hdWallet')
        mockGetKeyOrThrow.mockReturnValue({ keyId: 'key-hd' })
        mockWithHDSession.mockImplementation(async (_key, _dom, cb) =>
            cb({
                signTransaction: vi.fn().mockResolvedValue(new Uint8Array([9])),
            }),
        )

        const { result } = renderHook(() => useLocalKeyTransactionSigner())
        const txn = makeTxn('HD_ADDR')

        const signed = await result.current.signTransactions([txn], [0])

        expect(mockWithHDSession).toHaveBeenCalled()
        expect(signed).toHaveLength(1)
        expect(signed[0].sig).toEqual(new Uint8Array([9]))
    })

    test('signs algo25 transactions via withAlgo25Session', async () => {
        mockAccounts = [algo25Account]
        mockIsAlgo25Account.mockImplementation(acc => acc.type === 'algo25')
        mockGetKeyOrThrow.mockReturnValue({ keyId: 'key-algo25' })
        mockWithAlgo25Session.mockImplementation(async (_key, _dom, cb) =>
            cb({
                signTransaction: vi.fn().mockResolvedValue(new Uint8Array([7])),
            }),
        )

        const { result } = renderHook(() => useLocalKeyTransactionSigner())
        const txn = makeTxn('ALGO25_ADDR')

        const signed = await result.current.signTransactions([txn], [0])

        expect(mockWithAlgo25Session).toHaveBeenCalled()
        expect(signed).toHaveLength(1)
    })

    test('follows rekey to sign with rekeyed account', async () => {
        mockAccounts = [rekeyedAccount, algo25Account]
        mockIsAlgo25Account.mockImplementation(
            acc => acc.type === 'algo25' && !('rekeyAddress' in acc),
        )
        mockGetKeyOrThrow.mockReturnValue({ keyId: 'key-algo25' })
        mockWithAlgo25Session.mockImplementation(async (_key, _dom, cb) =>
            cb({
                signTransaction: vi.fn().mockResolvedValue(new Uint8Array([3])),
            }),
        )

        const { result } = renderHook(() => useLocalKeyTransactionSigner())
        const txn = makeTxn('REKEYED_ADDR')

        const signed = await result.current.signTransactions([txn], [0])

        // rekey target (algo25Account) should be used
        expect(mockWithAlgo25Session).toHaveBeenCalled()
        expect(signed).toHaveLength(1)
    })

    test('skips transactions not in indexesToSign (unsigned pass-through)', async () => {
        mockAccounts = [algo25Account]
        mockIsAlgo25Account.mockImplementation(acc => acc.type === 'algo25')
        mockGetKeyOrThrow.mockReturnValue({ keyId: 'key-algo25' })
        mockWithAlgo25Session.mockImplementation(async (_key, _dom, cb) =>
            cb({
                signTransaction: vi.fn().mockResolvedValue(new Uint8Array([1])),
            }),
        )

        const { result } = renderHook(() => useLocalKeyTransactionSigner())
        const txn1 = makeTxn('ALGO25_ADDR')
        const txn2 = makeTxn('ALGO25_ADDR')

        const signed = await result.current.signTransactions([txn1, txn2], [1])

        // index 0 should be unsigned (no sig); index 1 signed
        expect(signed[0]).toBeDefined()
        expect(signed[0].sig).toBeUndefined()
        expect(signed[1].sig).toBeDefined()
    })

    test('skips transactions for accounts not in the wallet', async () => {
        mockAccounts = []
        const { result } = renderHook(() => useLocalKeyTransactionSigner())
        const txn = makeTxn('UNKNOWN')

        const signed = await result.current.signTransactions([txn], [0])

        // Since no account matched, the original unsigned placeholder remains
        expect(signed[0].sig).toBeUndefined()
    })

    test('rejects when rekey target not found', async () => {
        mockAccounts = [rekeyedAccount] // only rekeyed, no target
        mockIsAlgo25Account.mockReturnValue(false)
        mockIsHDWalletAccount.mockReturnValue(false)

        const { result } = renderHook(() => useLocalKeyTransactionSigner())
        const txn = makeTxn('REKEYED_ADDR')

        await expect(
            result.current.signTransactions([txn], [0]),
        ).rejects.toContain('No rekeyed account found')
    })

    test('rejects for unsupported account type', async () => {
        mockAccounts = [unsupportedAccount]

        const { result } = renderHook(() => useLocalKeyTransactionSigner())
        const txn = makeTxn('UNKNOWN_ADDR')

        await expect(
            result.current.signTransactions([txn], [0]),
        ).rejects.toContain('Unsupported account type')
    })

    test('rejects hardware-wallet accounts — those go through the pipeline', async () => {
        // Given a HardwareWalletAccount sender, signTransactions must NOT
        // attempt to drive the BLE registry directly. The XState pipeline
        // routes hardware signing through hardwareSignerActor; this hook is
        // local-key only.
        mockAccounts = [hardwareAccount]
        mockIsHardwareWalletAccount.mockImplementation(
            acc => acc.type === 'hardware',
        )

        const { result } = renderHook(() => useTransactionSigner())
        const txn = makeTxn('LEDGER_ADDR')

        const signed = await result.current.signTransactions([txn], [0])

        expect(mockHardwareWalletRegistry.getProvider).toHaveBeenCalledWith(
            'ledger',
            'ble',
        )
        expect(mockHardwareTransportProvider.connect).toHaveBeenCalledWith(
            'device-1',
        )
        expect(mockTransport.getAddress).toHaveBeenCalledWith(0, false)
        // Ledger receives RAW msgpack (no "TX" domain-separation prefix) —
        // the device adds the prefix on-device before hashing.
        expect(encodeTransactionRawMock).toHaveBeenCalled()
        expect(encodeTransactionMock).not.toHaveBeenCalled()
        expect(mockTransport.signTransaction).toHaveBeenCalledWith(
            0,
            new Uint8Array([0x99]),
        )
        expect(mockTransport.disconnect).toHaveBeenCalled()
        expect(signed).toHaveLength(1)
        expect(signed[0].sig).toEqual(new Uint8Array([0xaa]))
    })

    test('rejects when hardware registry has no provider for manufacturer', async () => {
        mockAccounts = [hardwareAccount]
        mockIsHardwareWalletAccount.mockImplementation(
            acc => acc.type === 'hardware',
        )
        mockHardwareWalletRegistry.getProvider.mockReturnValue(undefined)

        const { result } = renderHook(() => useTransactionSigner())
        const txn = makeTxn('LEDGER_ADDR')

        await expect(
            result.current.signTransactions([makeTxn('LEDGER_ADDR')], [0]),
        ).rejects.toContain('Unsupported account type')
    })
})
