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
import { renderHook } from '@testing-library/react'
import { useHDWalletGroups } from '../useHDWalletGroups'
import type { WalletAccount } from '../../models'

const mockUseAllAccounts = vi.fn((): WalletAccount[] => [])

vi.mock('../useAllAccounts', () => ({
    useAllAccounts: () => mockUseAllAccounts(),
}))

const HD_ACCOUNT_WALLET_1 = {
    id: 'hd-1',
    address: 'HD_ADDRESS_1',
    name: 'My Wallet',
    type: 'hdWallet' as const,
    hdWalletDetails: {
        account: 0,
        change: 0,
        keyIndex: 0,
        derivationType: 9 as const,
    },
    keyPairId: 'wallet-1',
}

const HD_ACCOUNT_WALLET_1_B = {
    id: 'hd-1b',
    address: 'HD_ADDRESS_1B',
    type: 'hdWallet' as const,
    hdWalletDetails: {
        account: 0,
        change: 0,
        keyIndex: 1,
        derivationType: 9 as const,
    },
    keyPairId: 'wallet-1',
}

const HD_ACCOUNT_WALLET_2 = {
    id: 'hd-2',
    address: 'HD_ADDRESS_2',
    name: 'Second Wallet',
    type: 'hdWallet' as const,
    hdWalletDetails: {
        account: 0,
        change: 0,
        keyIndex: 0,
        derivationType: 9 as const,
    },
    keyPairId: 'wallet-2',
}

const ALGO25_ACCOUNT = {
    id: 'algo25-1',
    address: 'ALGO25_ADDRESS',
    type: 'algo25' as const,
    keyPairId: 'algo25-key-1',
}

const WATCH_ACCOUNT = {
    id: 'watch-1',
    address: 'WATCH_ADDRESS',
    type: 'watch' as const,
}

describe('useHDWalletGroups', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseAllAccounts.mockReturnValue([])
    })

    test('returns empty groups when no accounts exist', () => {
        const { result } = renderHook(() => useHDWalletGroups())

        expect(result.current.hdWalletGroups).toEqual([])
        expect(result.current.hasMultipleHDWallets).toBe(false)
    })

    test('returns empty groups when only non-HD accounts exist', () => {
        mockUseAllAccounts.mockReturnValue([ALGO25_ACCOUNT, WATCH_ACCOUNT])

        const { result } = renderHook(() => useHDWalletGroups())

        expect(result.current.hdWalletGroups).toEqual([])
        expect(result.current.hasMultipleHDWallets).toBe(false)
    })

    test('returns single group for one HD wallet', () => {
        mockUseAllAccounts.mockReturnValue([
            HD_ACCOUNT_WALLET_1,
            HD_ACCOUNT_WALLET_1_B,
        ])

        const { result } = renderHook(() => useHDWalletGroups())

        expect(result.current.hdWalletGroups).toHaveLength(1)
        expect(result.current.hdWalletGroups[0].keyPairId).toBe('wallet-1')
        expect(result.current.hdWalletGroups[0].accountCount).toBe(2)
        expect(result.current.hdWalletGroups[0].firstAccount).toBe(
            HD_ACCOUNT_WALLET_1,
        )
        expect(result.current.hasMultipleHDWallets).toBe(false)
    })

    test('returns multiple groups for multiple HD wallets', () => {
        mockUseAllAccounts.mockReturnValue([
            HD_ACCOUNT_WALLET_1,
            HD_ACCOUNT_WALLET_1_B,
            HD_ACCOUNT_WALLET_2,
        ])

        const { result } = renderHook(() => useHDWalletGroups())

        expect(result.current.hdWalletGroups).toHaveLength(2)
        expect(result.current.hasMultipleHDWallets).toBe(true)

        const group1 = result.current.hdWalletGroups.find(
            g => g.keyPairId === 'wallet-1',
        )!
        expect(group1.accountCount).toBe(2)
        expect(group1.firstAccount).toBe(HD_ACCOUNT_WALLET_1)

        const group2 = result.current.hdWalletGroups.find(
            g => g.keyPairId === 'wallet-2',
        )!
        expect(group2.accountCount).toBe(1)
        expect(group2.firstAccount).toBe(HD_ACCOUNT_WALLET_2)
    })

    test('filters out non-HD wallet accounts from groups', () => {
        mockUseAllAccounts.mockReturnValue([
            HD_ACCOUNT_WALLET_1,
            ALGO25_ACCOUNT,
            WATCH_ACCOUNT,
            HD_ACCOUNT_WALLET_2,
        ])

        const { result } = renderHook(() => useHDWalletGroups())

        expect(result.current.hdWalletGroups).toHaveLength(2)
        expect(result.current.hasMultipleHDWallets).toBe(true)
    })

    test('firstAccount points to the first account in each group', () => {
        mockUseAllAccounts.mockReturnValue([
            HD_ACCOUNT_WALLET_1,
            HD_ACCOUNT_WALLET_1_B,
        ])

        const { result } = renderHook(() => useHDWalletGroups())

        expect(result.current.hdWalletGroups[0].firstAccount.address).toBe(
            'HD_ADDRESS_1',
        )
    })
})
