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
    KeyType: {
        HDWalletRootKey: 'hdwallet-root-key',
        DeterministicP256Key: 'deterministic-p256-key',
        Algo25Key: 'algo25-key',
    },
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

// A participant that holds its own keys but has been rekeyed on chain.
// Multisig cosign needs THIS account's key (the participant slot is keyed
// by the original pubkey); the hook must not silently swap to the rekey
// target. Used by the regression test below.
const participantWithRekey = {
    address: 'PARTICIPANT_ADDR',
    type: 'algo25',
    keyPairId: 'key-participant',
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
        mockIsHDWalletAccount.mockImplementation(acc => acc.type === 'hdWallet')
        mockGetKeyOrThrow.mockReturnValue({ keyId: 'key-hd' })
        mockWithHDSession.mockImplementation(async (_key, _dom, cb) =>
            cb({
                signTransaction: vi.fn().mockResolvedValue(new Uint8Array([9])),
            }),
        )

        const { result } = renderHook(() => useLocalKeyTransactionSigner())
        const txn = makeTxn('HD_ADDR')

        const signed = await result.current.signTransactions(
            [txn],
            [0],
            hdAccount,
        )

        expect(mockWithHDSession).toHaveBeenCalled()
        expect(signed).toHaveLength(1)
        expect(signed[0].sig).toEqual(new Uint8Array([9]))
    })

    test('signs algo25 transactions via withAlgo25Session', async () => {
        mockIsAlgo25Account.mockImplementation(acc => acc.type === 'algo25')
        mockGetKeyOrThrow.mockReturnValue({ keyId: 'key-algo25' })
        mockWithAlgo25Session.mockImplementation(async (_key, _dom, cb) =>
            cb({
                signTransaction: vi.fn().mockResolvedValue(new Uint8Array([7])),
            }),
        )

        const { result } = renderHook(() => useLocalKeyTransactionSigner())
        const txn = makeTxn('ALGO25_ADDR')

        const signed = await result.current.signTransactions(
            [txn],
            [0],
            algo25Account,
        )

        expect(mockWithAlgo25Session).toHaveBeenCalled()
        expect(signed).toHaveLength(1)
    })

    test('does NOT follow rekey from the public signTransactions — caller must pre-resolve', async () => {
        // Regression: a multisig cosign request supplies the participant
        // account directly (with its own keyPairId) even though the participant
        // address is rekeyed on chain. The hook must sign with the passed-in
        // account's keyPairId, NOT silently swap to the rekey target — the
        // multisig participant slot is keyed by the original pubkey.
        // (For non-cosign flows the actor pre-resolves rekey before calling.)
        mockAccounts = [participantWithRekey, algo25Account]
        mockIsAlgo25Account.mockImplementation(acc => acc.type === 'algo25')
        mockWithAlgo25Session.mockImplementation(async (_key, _dom, cb) =>
            cb({
                signTransaction: vi.fn().mockResolvedValue(new Uint8Array([3])),
            }),
        )

        const { result } = renderHook(() => useLocalKeyTransactionSigner())
        const txn = makeTxn('PARTICIPANT_ADDR')

        const signed = await result.current.signTransactions(
            [txn],
            [0],
            participantWithRekey,
        )

        expect(mockWithAlgo25Session).toHaveBeenCalled()
        // Participant's own keyPairId drove the session — NOT the rekey target's.
        const sessionKey = mockWithAlgo25Session.mock.calls[0][0]
        expect(sessionKey.id).toBe('key-participant')
        expect(sessionKey.id).not.toBe('key-algo25')
        expect(signed).toHaveLength(1)
    })

    test('signs only the indexes in indexesToSign (unsigned pass-through)', async () => {
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

        const signed = await result.current.signTransactions(
            [txn1, txn2],
            [1],
            algo25Account,
        )

        // index 0 should be unsigned (no sig); index 1 signed
        expect(signed[0]).toBeDefined()
        expect(signed[0].sig).toBeUndefined()
        expect(signed[1].sig).toBeDefined()
    })

    test('signs with the explicit account even when txn.sender differs (multisig cosign)', async () => {
        // Regression: a multisig cosign request hands transactions whose
        // `sender` is the multisig account address, but the local signer is
        // an HD wallet *participant* whose address differs from the sender.
        // The hook must use the explicit `account` argument (the participant)
        // and ignore `txn.sender` — otherwise the wrong key would be picked.
        mockIsHDWalletAccount.mockImplementation(acc => acc.type === 'hdWallet')
        mockGetKeyOrThrow.mockReturnValue({ keyId: 'key-hd' })
        const sessionSign = vi.fn().mockResolvedValue(new Uint8Array([42]))
        mockWithHDSession.mockImplementation(async (_key, _dom, cb) =>
            cb({ signTransaction: sessionSign }),
        )

        const { result } = renderHook(() => useLocalKeyTransactionSigner())
        // sender is the multisig (NOT in our accounts list at all)
        const txn = makeTxn('MULTISIG_ADDR')

        const signed = await result.current.signTransactions(
            [txn],
            [0],
            hdAccount, // explicit signer = HD participant
        )

        expect(mockWithHDSession).toHaveBeenCalled()
        // The HD session was driven for the participant, not the multisig
        expect(mockGetKeyOrThrow).toHaveBeenCalledWith('key-hd')
        expect(signed).toHaveLength(1)
        expect(signed[0].sig).toEqual(new Uint8Array([42]))
    })

    test('rejects for unsupported account type', async () => {
        const { result } = renderHook(() => useLocalKeyTransactionSigner())
        const txn = makeTxn('UNKNOWN_ADDR')

        await expect(
            result.current.signTransactions([txn], [0], unsupportedAccount),
        ).rejects.toContain('Unsupported account type')
    })

    test('rejects hardware-wallet accounts — those go through the pipeline', async () => {
        // Given a HardwareWalletAccount, signTransactions must NOT attempt
        // to drive the BLE registry directly. The XState pipeline routes
        // hardware signing through hardwareSignerActor; this hook is
        // local-key only.
        mockIsHardwareWalletAccount.mockImplementation(
            acc => acc.type === 'hardware',
        )

        const { result } = renderHook(() => useLocalKeyTransactionSigner())

        await expect(
            result.current.signTransactions(
                [makeTxn('LEDGER_ADDR')],
                [0],
                hardwareAccount,
            ),
        ).rejects.toContain('Unsupported account type')
    })
})
