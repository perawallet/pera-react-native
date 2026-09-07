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
import {
    AccountTypes,
    DuplicateAccountError,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { AsbAccountKind, type AsbBackupAccount } from '../../models'

const mockImportAlgo25 = vi.fn()
const mockUpdateAccount = vi.fn()
const mockMarkBackupComplete = vi.fn()
const mockSetAccounts = vi.fn()
const mockAlgo25SeedToIndices = vi.fn()
const mockIsValidAlgorandAddress = vi.fn()
const mockZeroBytes = vi.fn()

let storeAccounts: WalletAccount[] = []

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    // The accounts barrel installs a network-switch subscription at load.
    useNetworkStore: {
        getState: () => ({ network: 'mainnet' }),
        subscribe: () => () => {},
    },
    isValidAlgorandAddress: (...args: unknown[]) =>
        mockIsValidAlgorandAddress(...args),
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    ALGO25_SEED_LENGTH: 32,
    algo25SeedToIndices: (...args: unknown[]) =>
        mockAlgo25SeedToIndices(...args),
    zeroBytes: (...args: unknown[]) => mockZeroBytes(...args),
}))

vi.mock('../../../mnemonic', () => ({
    useMarkMnemonicBackupComplete: () => mockMarkBackupComplete,
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    const useAccountsStore = ((selector: (state: unknown) => unknown) =>
        selector({ setAccounts: mockSetAccounts })) as unknown as ((
        selector: (state: unknown) => unknown,
    ) => unknown) & { getState: () => unknown }
    useAccountsStore.getState = () => ({ accounts: storeAccounts })
    return {
        ...original,
        useImportAccount: () => mockImportAlgo25,
        useUpdateAccount: () => mockUpdateAccount,
        useAccountsStore,
    }
})

// Imported after the mocks so the hook's module sees the stubs.
const importHook = async () => {
    const { useAsbAccountImport } = await import('../useAsbAccountImport')
    return useAsbAccountImport
}

const VALID_ADDRESS_A =
    'EGRJQ7DXMIJ577UUN6AFOIUZY6CNSFKLMGFHQNTC5US5TRC23LK6DGQRDM'
const VALID_ADDRESS_B =
    '7TTLR5VQAY5YVQ5QV4IBOVIKUULGVNPURNWM5NG7M7ELEOQPVROA4CS3FM'

const singleAccount = (
    overrides: Partial<AsbBackupAccount> = {},
): AsbBackupAccount => ({
    address: VALID_ADDRESS_A,
    name: null,
    kind: AsbAccountKind.Single,
    // tweetnacl secret key shape: seed (32) || pubKey (32)
    privateKey: new Uint8Array(64).fill(1),
    ...overrides,
})

const watchAccount = (
    overrides: Partial<AsbBackupAccount> = {},
): AsbBackupAccount => ({
    address: VALID_ADDRESS_B,
    name: null,
    kind: AsbAccountKind.Watch,
    privateKey: null,
    ...overrides,
})

const algo25Account = (address: string): WalletAccount => ({
    id: address,
    address,
    type: AccountTypes.algo25,
    keyPairId: 'kp-1',
})

describe('useAsbAccountImport', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        storeAccounts = []
        mockIsValidAlgorandAddress.mockReturnValue(true)
        mockAlgo25SeedToIndices.mockReturnValue(new Uint16Array(25).fill(1))
    })

    test('throws when the asb account address is not a valid Algorand address', async () => {
        mockIsValidAlgorandAddress.mockReturnValue(false)
        const useAsbAccountImport = await importHook()
        const { result } = renderHook(() => useAsbAccountImport())

        await expect(
            result.current.importAccount(
                singleAccount({ address: 'NOT_VALID' }),
            ),
        ).rejects.toThrow('Invalid Algorand address: NOT_VALID')

        expect(mockImportAlgo25).not.toHaveBeenCalled()
        expect(mockSetAccounts).not.toHaveBeenCalled()
    })

    test('throws when a single account is missing its private key', async () => {
        const useAsbAccountImport = await importHook()
        const { result } = renderHook(() => useAsbAccountImport())

        await expect(
            result.current.importAccount(singleAccount({ privateKey: null })),
        ).rejects.toThrow('ASB single account missing private_key after parse')

        expect(mockImportAlgo25).not.toHaveBeenCalled()
    })

    test('throws when the private key is shorter than the 32-byte seed', async () => {
        const useAsbAccountImport = await importHook()
        const { result } = renderHook(() => useAsbAccountImport())

        await expect(
            result.current.importAccount(
                singleAccount({ privateKey: new Uint8Array(16) }),
            ),
        ).rejects.toThrow('Algo25 private_key shorter than 32 bytes')

        expect(mockImportAlgo25).not.toHaveBeenCalled()
    })

    test('imports a single account, marks it backed up, and zeroes the seed buffer', async () => {
        const imported = algo25Account(VALID_ADDRESS_A)
        mockImportAlgo25.mockResolvedValue(imported)

        const useAsbAccountImport = await importHook()
        const { result } = renderHook(() => useAsbAccountImport())

        const account = singleAccount()
        const returned = await result.current.importAccount(account)

        expect(mockAlgo25SeedToIndices).toHaveBeenCalledTimes(1)
        const seedArg = mockAlgo25SeedToIndices.mock.calls[0][0] as Uint8Array
        // We must pass exactly the 32-byte seed half — and a *copy*, not a
        // subarray that would share memory with `account.privateKey`.
        expect(seedArg).toBeInstanceOf(Uint8Array)
        expect(seedArg.length).toBe(32)
        expect(seedArg.buffer).not.toBe(account.privateKey!.buffer)

        expect(mockImportAlgo25).toHaveBeenCalledWith({
            mnemonicIndices: expect.objectContaining({ length: 25 }),
            type: 'algo25',
        })
        // No `name` on the asb row, so updateAccount must not be called.
        expect(mockUpdateAccount).not.toHaveBeenCalled()
        expect(mockMarkBackupComplete).toHaveBeenCalledWith(imported)
        expect(mockZeroBytes).toHaveBeenCalledWith(
            seedArg,
            expect.objectContaining({ length: 25 }),
        )
        expect(returned).toBe(imported)
    })

    test('renames the imported account when the asb row carries a name', async () => {
        const imported = algo25Account(VALID_ADDRESS_A)
        mockImportAlgo25.mockResolvedValue(imported)

        const useAsbAccountImport = await importHook()
        const { result } = renderHook(() => useAsbAccountImport())

        const returned = await result.current.importAccount(
            singleAccount({ name: 'Savings' }),
        )

        expect(mockUpdateAccount).toHaveBeenCalledTimes(1)
        const updated = mockUpdateAccount.mock.calls[0][0] as WalletAccount
        expect(updated.name).toBe('Savings')
        expect(updated.address).toBe(VALID_ADDRESS_A)
        expect(mockMarkBackupComplete).toHaveBeenCalledWith(updated)
        expect(returned).toEqual({ ...imported, name: 'Savings' })
    })

    test('rejects when useImportAccount unexpectedly returns an HD pending result', async () => {
        mockImportAlgo25.mockResolvedValue({
            type: 'hdWallet',
            walletKeyId: 'kp-hd',
            derivationType: 9,
        })

        const useAsbAccountImport = await importHook()
        const { result } = renderHook(() => useAsbAccountImport())

        await expect(
            result.current.importAccount(singleAccount()),
        ).rejects.toThrow(
            'Unexpected non-account result for algo25 seed import',
        )

        expect(mockMarkBackupComplete).not.toHaveBeenCalled()
        // The finally block must still wipe the seed buffer.
        expect(mockZeroBytes).toHaveBeenCalledTimes(1)
    })

    test('zeroes the seed buffer even when the underlying import throws', async () => {
        mockImportAlgo25.mockRejectedValue(new Error('keystore exploded'))

        const useAsbAccountImport = await importHook()
        const { result } = renderHook(() => useAsbAccountImport())

        await expect(
            result.current.importAccount(singleAccount()),
        ).rejects.toThrow('keystore exploded')

        expect(mockZeroBytes).toHaveBeenCalledTimes(1)
        expect(mockMarkBackupComplete).not.toHaveBeenCalled()
    })

    test('persists a watch account when no duplicate exists', async () => {
        const existing = algo25Account(VALID_ADDRESS_A)
        storeAccounts = [existing]

        const useAsbAccountImport = await importHook()
        const { result } = renderHook(() => useAsbAccountImport())

        const returned = await result.current.importAccount(watchAccount())

        expect(mockSetAccounts).toHaveBeenCalledTimes(1)
        const written = mockSetAccounts.mock.calls[0][0] as WalletAccount[]
        expect(written).toHaveLength(2)
        // Preserves prior accounts and appends the new watch row.
        expect(written[0]).toBe(existing)
        expect(written[1]).toMatchObject({
            address: VALID_ADDRESS_B,
            type: AccountTypes.watch,
        })
        expect(returned).toMatchObject({
            address: VALID_ADDRESS_B,
            type: AccountTypes.watch,
        })
        // Watch accounts never touch KMS or the backup-complete signal.
        expect(mockMarkBackupComplete).not.toHaveBeenCalled()
        expect(mockImportAlgo25).not.toHaveBeenCalled()
    })

    test('preserves the asb name on the persisted watch account', async () => {
        const useAsbAccountImport = await importHook()
        const { result } = renderHook(() => useAsbAccountImport())

        await result.current.importAccount(watchAccount({ name: 'Cold' }))

        const written = mockSetAccounts.mock.calls[0][0] as WalletAccount[]
        expect(written[0].name).toBe('Cold')
    })

    test('throws DuplicateAccountError when the watch address already exists', async () => {
        storeAccounts = [
            { ...algo25Account(VALID_ADDRESS_B), type: AccountTypes.watch },
        ]

        const useAsbAccountImport = await importHook()
        const { result } = renderHook(() => useAsbAccountImport())

        await expect(
            result.current.importAccount(watchAccount()),
        ).rejects.toBeInstanceOf(DuplicateAccountError)

        expect(mockSetAccounts).not.toHaveBeenCalled()
    })

    test('reads the live store between successive watch imports rather than a captured snapshot', async () => {
        // Simulates the caller loop: first import adds an account, the second
        // import must see it via getState() to avoid clobbering it.
        const useAsbAccountImport = await importHook()
        const { result } = renderHook(() => useAsbAccountImport())

        const first = await result.current.importAccount(watchAccount())
        // Caller would normally push the new account into the store after a
        // successful setAccounts; emulate that here by mutating storeAccounts.
        storeAccounts = [first]

        await result.current.importAccount(
            watchAccount({ address: VALID_ADDRESS_A }),
        )

        const secondWrite = mockSetAccounts.mock.calls[1][0] as WalletAccount[]
        expect(secondWrite).toHaveLength(2)
        expect(secondWrite[0]).toBe(first)
        expect(secondWrite[1].address).toBe(VALID_ADDRESS_A)
    })
})
