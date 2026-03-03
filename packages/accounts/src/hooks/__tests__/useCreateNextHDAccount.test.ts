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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCreateNextHDAccount } from '../useCreateNextHDAccount'
import type { WalletAccount } from '../../models'

const mockCreateAccount = {
    createHdWalletAccount: vi.fn(),
    createAlgo25WalletAccount: vi.fn(),
}
const mockUseAllAccounts = vi.fn((): WalletAccount[] => [])

vi.mock('../useAllAccounts', () => ({
    useAllAccounts: () => mockUseAllAccounts(),
}))

vi.mock('../useCreateAccount', () => ({
    useCreateAccount: () => mockCreateAccount,
}))

const HD_ACCOUNT = {
    id: 'hd-1',
    address: 'HD_ADDRESS',
    type: 'hdWallet' as const,
    hdWalletDetails: {
        account: 0,
        change: 0,
        keyIndex: 0,
        derivationType: 9 as const,
    },
    keyPairId: 'wallet-1',
}

describe('useCreateNextHDAccount', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAllAccounts.mockReturnValue([])
    })

    test('hasHDWallet is false when no HD wallet accounts exist', () => {
        mockUseAllAccounts.mockReturnValue([])

        const { result } = renderHook(() => useCreateNextHDAccount())

        expect(result.current.hasHDWallet).toBe(false)
    })

    test('hasHDWallet is true when HD wallet accounts exist', () => {
        mockUseAllAccounts.mockReturnValue([HD_ACCOUNT])

        const { result } = renderHook(() => useCreateNextHDAccount())

        expect(result.current.hasHDWallet).toBe(true)
    })

    test('createNextHDAccount returns null when no HD wallet accounts exist', async () => {
        mockUseAllAccounts.mockReturnValue([])

        const { result } = renderHook(() => useCreateNextHDAccount())

        let account: WalletAccount | null = null
        await act(async () => {
            account = await result.current.createNextHDAccount()
        })

        expect(account).toBeNull()
        expect(mockCreateAccount.createHdWalletAccount).not.toHaveBeenCalled()
    })

    test('createNextHDAccount calculates correct next keyIndex', async () => {
        const secondHDAccount = {
            ...HD_ACCOUNT,
            id: 'hd-2',
            address: 'HD_ADDRESS_2',
            hdWalletDetails: {
                ...HD_ACCOUNT.hdWalletDetails,
                account: 1,
            },
        }
        mockUseAllAccounts.mockReturnValue([HD_ACCOUNT, secondHDAccount])

        const newAccount = {
            id: 'new-hd',
            address: 'NEW_HD_ADDRESS',
            type: 'hdWallet' as const,
            keyPairId: 'wallet-1',
        }
        mockCreateAccount.createHdWalletAccount.mockResolvedValue(newAccount)

        const { result } = renderHook(() => useCreateNextHDAccount())

        await act(async () => {
            await result.current.createNextHDAccount()
        })

        expect(mockCreateAccount.createHdWalletAccount).toHaveBeenCalledWith({
            walletId: 'wallet-1',
            account: 2,
            keyIndex: 0,
        })
    })

    test('createNextHDAccount uses walletId from first HD account', async () => {
        mockUseAllAccounts.mockReturnValue([HD_ACCOUNT])
        mockCreateAccount.createHdWalletAccount.mockResolvedValue({
            id: 'new',
            address: 'NEW',
            type: 'hdWallet',
        })

        const { result } = renderHook(() => useCreateNextHDAccount())

        await act(async () => {
            await result.current.createNextHDAccount()
        })

        expect(mockCreateAccount.createHdWalletAccount).toHaveBeenCalledWith({
            walletId: 'wallet-1',
            account: 1,
            keyIndex: 0,
        })
    })
})
