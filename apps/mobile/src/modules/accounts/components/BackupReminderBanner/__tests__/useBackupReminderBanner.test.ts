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
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

const mockLaunch = vi.fn()
vi.mock('@modules/backup', () => ({
    useBackupFlowLauncher: () => mockLaunch,
}))

// The visibility rule itself is owned and tested by
// useShouldPromptMnemonicBackup in wallet-core-backup.
const mockShouldPrompt = vi.fn()
vi.mock('@perawallet/wallet-core-backup', () => ({
    useShouldPromptMnemonicBackup: (account: WalletAccount | null) =>
        mockShouldPrompt(account),
}))

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

describe('useBackupReminderBanner', () => {
    beforeEach(() => {
        mockLaunch.mockReset()
        mockShouldPrompt.mockReset()
    })

    test('isVisible mirrors the shared backup-prompt rule', () => {
        mockShouldPrompt.mockReturnValue(true)

        const { result } = renderHook(() => useBackupReminderBanner(accountHD))
        expect(result.current.isVisible).toBe(true)
        expect(mockShouldPrompt).toHaveBeenCalledWith(accountHD)

        mockShouldPrompt.mockReturnValue(false)
        const { result: hidden } = renderHook(() =>
            useBackupReminderBanner(accountHD),
        )
        expect(hidden.current.isVisible).toBe(false)
    })

    test('onPress calls launcher with the account', () => {
        mockShouldPrompt.mockReturnValue(true)

        const { result } = renderHook(() => useBackupReminderBanner(accountHD))
        act(() => result.current.onPress())
        expect(mockLaunch).toHaveBeenCalledWith(accountHD)
    })
})
