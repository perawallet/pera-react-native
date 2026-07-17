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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
    AccountTypes,
    DuplicateAccountError,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

const mocks = vi.hoisted(() => ({
    importAlgo25: vi.fn(),
    updateAccount: vi.fn(),
    markBackupComplete: vi.fn(),
    mnemonicFromSeed: vi.fn(),
    isValidAlgorandAddress: vi.fn(),
    zeroBytes: vi.fn(),
}))

vi.mock('algosdk', async importOriginal => ({
    ...(await importOriginal<typeof import('algosdk')>()),
    mnemonicFromSeed: mocks.mnemonicFromSeed,
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    // The accounts barrel installs a network-switch subscription at load.
    useNetworkStore: {
        getState: () => ({ network: 'mainnet' }),
        subscribe: () => () => {},
    },
    isValidAlgorandAddress: mocks.isValidAlgorandAddress,
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    ALGO25_SEED_LENGTH: 32,
    zeroBytes: mocks.zeroBytes,
}))

vi.mock('../../mnemonic', () => ({
    useMarkMnemonicBackupComplete: () => mocks.markBackupComplete,
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...original,
        useImportAccount: () => mocks.importAlgo25,
        useUpdateAccount: () => mocks.updateAccount,
    }
})

import { useImportAlgo25FromSeed } from '../useImportAlgo25FromSeed'

const VALID_ADDRESS =
    'EGRJQ7DXMIJ577UUN6AFOIUZY6CNSFKLMGFHQNTC5US5TRC23LK6DGQRDM'

const importedAccount: WalletAccount = {
    id: 'acc-1',
    address: VALID_ADDRESS,
    type: AccountTypes.algo25,
    name: null,
} as WalletAccount

const renderImport = () =>
    renderHook(() => useImportAlgo25FromSeed()).result.current.importFromSeed

beforeEach(() => {
    vi.clearAllMocks()
    mocks.isValidAlgorandAddress.mockReturnValue(true)
    mocks.mnemonicFromSeed.mockReturnValue('mock mnemonic phrase')
    mocks.importAlgo25.mockResolvedValue(importedAccount)
    // Real-ish wipe so the defensive-copy assertion is meaningful.
    mocks.zeroBytes.mockImplementation((buf: Uint8Array) => buf.fill(0))
})

describe('useImportAlgo25FromSeed', () => {
    it('rebuilds the mnemonic from the seed and imports as algo25', async () => {
        const importFromSeed = renderImport()

        const result = await importFromSeed({
            address: VALID_ADDRESS,
            privateKey: new Uint8Array(64).fill(7),
        })

        expect(mocks.mnemonicFromSeed).toHaveBeenCalledWith(
            expect.objectContaining({ length: 32 }),
        )
        expect(mocks.importAlgo25).toHaveBeenCalledWith({
            mnemonic: 'mock mnemonic phrase',
            type: 'algo25',
        })
        expect(mocks.markBackupComplete).toHaveBeenCalledWith(importedAccount)
        expect(mocks.updateAccount).not.toHaveBeenCalled()
        expect(result).toEqual(importedAccount)
    })

    it('applies and persists a user-supplied name', async () => {
        const importFromSeed = renderImport()

        const result = await importFromSeed({
            address: VALID_ADDRESS,
            privateKey: new Uint8Array(64).fill(7),
            name: 'My Account',
        })

        expect(result.name).toBe('My Account')
        expect(mocks.updateAccount).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'My Account' }),
        )
        expect(mocks.markBackupComplete).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'My Account' }),
        )
    })

    it('rejects an invalid address before any keystore work', async () => {
        mocks.isValidAlgorandAddress.mockReturnValue(false)
        const importFromSeed = renderImport()

        await expect(
            importFromSeed({
                address: 'not-an-address',
                privateKey: new Uint8Array(64).fill(7),
            }),
        ).rejects.toThrow('Invalid Algorand address')
        expect(mocks.importAlgo25).not.toHaveBeenCalled()
        expect(mocks.zeroBytes).not.toHaveBeenCalled()
    })

    it('throws when the private key is shorter than the seed length', async () => {
        const importFromSeed = renderImport()

        await expect(
            importFromSeed({
                address: VALID_ADDRESS,
                privateKey: new Uint8Array(16),
            }),
        ).rejects.toThrow('shorter than 32 bytes')
        expect(mocks.importAlgo25).not.toHaveBeenCalled()
        // sliceSeed throws before the try/finally, so nothing is wiped.
        expect(mocks.zeroBytes).not.toHaveBeenCalled()
    })

    it('throws when the underlying import yields a non-account result', async () => {
        mocks.importAlgo25.mockResolvedValue({ seedPhrase: 'hd-result' })
        const importFromSeed = renderImport()

        await expect(
            importFromSeed({
                address: VALID_ADDRESS,
                privateKey: new Uint8Array(64).fill(7),
            }),
        ).rejects.toThrow('Unexpected non-account result')
        // Seed is still wiped even on the error path.
        expect(mocks.zeroBytes).toHaveBeenCalledTimes(1)
    })

    it('re-throws DuplicateAccountError and still wipes the seed', async () => {
        mocks.importAlgo25.mockRejectedValue(
            new DuplicateAccountError(VALID_ADDRESS),
        )
        const importFromSeed = renderImport()

        await expect(
            importFromSeed({
                address: VALID_ADDRESS,
                privateKey: new Uint8Array(64).fill(7),
            }),
        ).rejects.toBeInstanceOf(DuplicateAccountError)
        expect(mocks.zeroBytes).toHaveBeenCalledTimes(1)
    })

    it('wipes the derived seed copy without mutating the caller buffer', async () => {
        const callerKey = new Uint8Array(64).fill(7)
        const importFromSeed = renderImport()

        await importFromSeed({ address: VALID_ADDRESS, privateKey: callerKey })

        // The defensive `.slice` means the caller's buffer is untouched...
        expect(callerKey.every(b => b === 7)).toBe(true)
        // ...while the 32-byte derived seed copy was handed to `zeroBytes` in
        // `finally`. (Not asserting the buffer is all-zero: the mock fills it,
        // so that would test the mock, not the production wipe.)
        expect(mocks.zeroBytes).toHaveBeenCalledTimes(1)
        const wiped = mocks.zeroBytes.mock.calls[0][0] as Uint8Array
        expect(wiped).toHaveLength(32)
    })
})
