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
import { renderHook, act } from '@testing-library/react'
import { Decimal } from 'decimal.js'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

const mockLaunch = vi.fn()
vi.mock('@modules/backup', () => ({
    useBackupFlowLauncher: () => mockLaunch,
}))

const mockIsBackedUp = vi.fn()
const mockGetBackupKeyId = vi.fn()
vi.mock('@perawallet/wallet-core-backup', () => ({
    useIsAccountBackedUp: (account: WalletAccount | null) =>
        mockIsBackedUp(account),
    getBackupKeyId: (account: WalletAccount) => mockGetBackupKeyId(account),
}))

const mockBalancesQuery = vi.fn()
vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...original,
        useAccountBalancesQuery: (...args: unknown[]) =>
            mockBalancesQuery(...args),
    }
})

import { useBackupReminderBanner } from '../useBackupReminderBanner'

const accountHD: WalletAccount = {
    type: AccountTypes.hdWallet,
    address: 'HD1',
    keyPairId: 'kp',
    entropyKeyId: 'entropy-1',
    hdWalletDetails: {
        account: 0,
        change: 0,
        keyIndex: 0,
        derivationType: 9,
    },
}

const accountWatch: WalletAccount = {
    type: AccountTypes.watch,
    address: 'WATCH1',
}

const balancesWith = (addr: string, algoBalance: Decimal) => ({
    accountBalances: new Map([
        [
            addr,
            {
                assetBalances: [{ assetId: '0', amount: algoBalance }],
                algoValue: algoBalance,
            },
        ],
    ]),
})

describe('useBackupReminderBanner', () => {
    beforeEach(() => {
        mockLaunch.mockReset()
        mockIsBackedUp.mockReset()
        mockGetBackupKeyId.mockReset()
        mockBalancesQuery.mockReset()
        mockGetBackupKeyId.mockReturnValue('entropy-1')
    })

    test('isVisible false when account is backed up', () => {
        mockIsBackedUp.mockReturnValue(true)
        mockBalancesQuery.mockReturnValue(
            balancesWith(accountHD.address, new Decimal(1_000_000)),
        )

        const { result } = renderHook(() => useBackupReminderBanner(accountHD))
        expect(result.current.isVisible).toBe(false)
    })

    test('isVisible false when account balance is 0', () => {
        mockIsBackedUp.mockReturnValue(false)
        mockBalancesQuery.mockReturnValue(
            balancesWith(accountHD.address, new Decimal(0)),
        )

        const { result } = renderHook(() => useBackupReminderBanner(accountHD))
        expect(result.current.isVisible).toBe(false)
    })

    test('isVisible false for watch account even with balance', () => {
        mockIsBackedUp.mockReturnValue(true)
        mockGetBackupKeyId.mockReturnValue(null)
        mockBalancesQuery.mockReturnValue(
            balancesWith(accountWatch.address, new Decimal(9_000_000)),
        )

        const { result } = renderHook(() =>
            useBackupReminderBanner(accountWatch),
        )
        expect(result.current.isVisible).toBe(false)
    })

    test('isVisible true when unbacked HD account has balance > 0', () => {
        mockIsBackedUp.mockReturnValue(false)
        mockBalancesQuery.mockReturnValue(
            balancesWith(accountHD.address, new Decimal(1)),
        )

        const { result } = renderHook(() => useBackupReminderBanner(accountHD))
        expect(result.current.isVisible).toBe(true)
    })

    test('onPress calls launcher with the account', () => {
        mockIsBackedUp.mockReturnValue(false)
        mockBalancesQuery.mockReturnValue(
            balancesWith(accountHD.address, new Decimal(5_000_000)),
        )

        const { result } = renderHook(() => useBackupReminderBanner(accountHD))
        act(() => result.current.onPress())
        expect(mockLaunch).toHaveBeenCalledWith(accountHD)
    })
})
