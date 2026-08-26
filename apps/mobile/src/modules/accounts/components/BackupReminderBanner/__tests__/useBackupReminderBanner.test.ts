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

const mockRequiresBackup = vi.fn()
vi.mock('@perawallet/wallet-core-backup', () => ({
    useRequiresMnemonicBackup: (account: WalletAccount | null) =>
        mockRequiresBackup(account),
}))

const mockSummaryQuery = vi.fn()
vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...original,
        useAccountSummaryQuery: (...args: unknown[]) =>
            mockSummaryQuery(...args),
    }
})

import { useBackupReminderBanner } from '../useBackupReminderBanner'

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

// The banner only needs the ALGO amount, served by the one-row SQL summary —
// not the full holdings walk (PERA-4953).
const summaryWith = (algoAmount: Decimal) => ({
    algoAmount,
    portfolioUsdValue: new Decimal(0),
    portfolioAlgoValue: algoAmount,
    holdingsCount: 1,
    isComplete: true,
    isPending: false,
    isError: false,
    isPaused: false,
})

describe('useBackupReminderBanner', () => {
    beforeEach(() => {
        mockLaunch.mockReset()
        mockRequiresBackup.mockReset()
        mockSummaryQuery.mockReset()
    })

    test('isVisible false when account does not require backup', () => {
        mockRequiresBackup.mockReturnValue(false)
        mockSummaryQuery.mockReturnValue(summaryWith(new Decimal(1)))

        const { result } = renderHook(() => useBackupReminderBanner(accountHD))
        expect(result.current.isVisible).toBe(false)
    })

    test('isVisible false when account balance is 0', () => {
        mockRequiresBackup.mockReturnValue(true)
        mockSummaryQuery.mockReturnValue(summaryWith(new Decimal(0)))

        const { result } = renderHook(() => useBackupReminderBanner(accountHD))
        expect(result.current.isVisible).toBe(false)
    })

    test('isVisible true when account requires backup and has balance > 0', () => {
        mockRequiresBackup.mockReturnValue(true)
        mockSummaryQuery.mockReturnValue(summaryWith(new Decimal(0.000001)))

        const { result } = renderHook(() => useBackupReminderBanner(accountHD))
        expect(result.current.isVisible).toBe(true)
    })

    test('onPress calls launcher with the account', () => {
        mockRequiresBackup.mockReturnValue(true)
        mockSummaryQuery.mockReturnValue(summaryWith(new Decimal(5)))

        const { result } = renderHook(() => useBackupReminderBanner(accountHD))
        act(() => result.current.onPress())
        expect(mockLaunch).toHaveBeenCalledWith(accountHD)
    })
})
