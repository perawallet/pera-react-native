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
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

const mockRequiresBackup = vi.fn()
vi.mock('../useRequiresMnemonicBackup', () => ({
    useRequiresMnemonicBackup: (account: WalletAccount | null | undefined) =>
        mockRequiresBackup(account),
}))

const mockFundedNetworks = vi.fn()
const mockAccountsRekeyedTo = vi.fn()
vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...original,
        useAccountFundedNetworksQuery: (...args: unknown[]) =>
            mockFundedNetworks(...args),
        useAccountsRekeyedTo: (...args: unknown[]) =>
            mockAccountsRekeyedTo(...args),
    }
})

import { useShouldPromptMnemonicBackup } from '../useShouldPromptMnemonicBackup'

const accountHD: WalletAccount = {
    id: 'hd-account',
    type: AccountTypes.hdWallet,
    address: 'HD1',
    keyPairId: 'kp',
    hdWalletDetails: {
        account: 0,
        change: 0,
        keyIndex: 0,
        derivationType: 9,
    },
}

const fundedOn = (...networks: string[]) => ({
    fundedNetworks: networks,
    isFunded: networks.length > 0,
    isPending: false,
    isError: false,
})

describe('useShouldPromptMnemonicBackup', () => {
    beforeEach(() => {
        mockRequiresBackup.mockReset()
        mockFundedNetworks.mockReset()
        mockAccountsRekeyedTo.mockReset()
        mockAccountsRekeyedTo.mockReturnValue([])
    })

    test('false when the account does not require backup', () => {
        mockRequiresBackup.mockReturnValue(false)
        mockFundedNetworks.mockReturnValue(fundedOn('mainnet'))

        const { result } = renderHook(() =>
            useShouldPromptMnemonicBackup(accountHD),
        )
        expect(result.current).toBe(false)
    })

    test('false when the account is unfunded and signs for nothing', () => {
        mockRequiresBackup.mockReturnValue(true)
        mockFundedNetworks.mockReturnValue(fundedOn())

        const { result } = renderHook(() =>
            useShouldPromptMnemonicBackup(accountHD),
        )
        expect(result.current).toBe(false)
    })

    test('true when the only funded network is not the active one', () => {
        mockRequiresBackup.mockReturnValue(true)
        mockFundedNetworks.mockReturnValue(fundedOn('testnet'))

        const { result } = renderHook(() =>
            useShouldPromptMnemonicBackup(accountHD),
        )
        expect(result.current).toBe(true)
    })

    test('true when the account requires backup and has balance > 0', () => {
        mockRequiresBackup.mockReturnValue(true)
        mockFundedNetworks.mockReturnValue(fundedOn('mainnet'))

        const { result } = renderHook(() =>
            useShouldPromptMnemonicBackup(accountHD),
        )
        expect(result.current).toBe(true)
    })

    test("true when an unfunded account is another account's rekey target", () => {
        mockRequiresBackup.mockReturnValue(true)
        mockFundedNetworks.mockReturnValue(fundedOn())
        mockAccountsRekeyedTo.mockReturnValue([
            { id: 'a', type: AccountTypes.algo25, address: 'A' },
        ])

        const { result } = renderHook(() =>
            useShouldPromptMnemonicBackup(accountHD),
        )
        expect(result.current).toBe(true)
        expect(mockAccountsRekeyedTo).toHaveBeenCalledWith(accountHD.address)
    })

    test('false for a rekey target that no longer needs backup', () => {
        mockRequiresBackup.mockReturnValue(false)
        mockFundedNetworks.mockReturnValue(fundedOn())
        mockAccountsRekeyedTo.mockReturnValue([
            { id: 'a', type: AccountTypes.algo25, address: 'A' },
        ])

        const { result } = renderHook(() =>
            useShouldPromptMnemonicBackup(accountHD),
        )
        expect(result.current).toBe(false)
    })

    test('false and skips lookups for an undefined account', () => {
        mockRequiresBackup.mockReturnValue(false)
        mockFundedNetworks.mockReturnValue(fundedOn())

        const { result } = renderHook(() =>
            useShouldPromptMnemonicBackup(undefined),
        )
        expect(result.current).toBe(false)
        expect(mockFundedNetworks).toHaveBeenCalledWith(undefined)
        expect(mockAccountsRekeyedTo).toHaveBeenCalledWith(undefined)
    })
})
