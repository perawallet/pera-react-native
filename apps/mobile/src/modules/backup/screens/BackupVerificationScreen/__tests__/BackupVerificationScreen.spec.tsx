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
import React from 'react'
import { render, screen, fireEvent } from '@test-utils/render'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

const mockReplace = vi.fn()
const mockNavigate = vi.fn()
const mockMarkBackup = vi.fn()

const account: WalletAccount = {
    type: AccountTypes.algo25,
    address: 'ADDR',
    keyPairId: 'kp',
    seedKeyId: 'seed-1',
}

vi.mock('@react-navigation/native', async importOriginal => {
    const original =
        await importOriginal<typeof import('@react-navigation/native')>()
    return {
        ...original,
        useNavigation: () => ({ replace: mockReplace, navigate: mockNavigate }),
        useRoute: () => ({ params: { address: 'ADDR' } }),
    }
})

vi.mock('@perawallet/wallet-core-backup', () => ({
    useMarkBackupComplete: () => mockMarkBackup,
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...original,
        useAccountsStore: (
            selector: (state: { accounts: WalletAccount[] }) => unknown,
        ) => selector({ accounts: [account] }),
    }
})

vi.mock('../../../context', () => ({
    useBackupFlowWords: () => ({
        getWords: () => ['alpha', 'bravo'],
        setWords: vi.fn(),
        clearWords: vi.fn(),
    }),
}))

vi.mock('expo-haptics', () => ({
    notificationAsync: vi.fn(),
    NotificationFeedbackType: { Error: 'error' },
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (k: string) => k }),
}))

import { BackupVerificationScreen } from '../BackupVerificationScreen'

describe('BackupVerificationScreen', () => {
    beforeEach(() => {
        mockReplace.mockReset()
        mockNavigate.mockReset()
        mockMarkBackup.mockReset()
    })

    test('tapping Finish with correct order marks backup and navigates to success', () => {
        render(<BackupVerificationScreen />)

        fireEvent.click(screen.getByText('alpha'))
        fireEvent.click(screen.getByText('bravo'))
        fireEvent.click(screen.getByTestId('backup_verification_finish'))

        expect(mockMarkBackup).toHaveBeenCalledWith(account)
        // accept either replace or navigate call — component implementation may use either
        const navCall = mockReplace.mock.calls[0] ?? mockNavigate.mock.calls[0]
        expect(navCall?.[0]).toBe('BackupSuccess')
    })

    test('tapping Finish with wrong order shows error message and does NOT navigate', () => {
        render(<BackupVerificationScreen />)

        fireEvent.click(screen.getByText('bravo'))
        fireEvent.click(screen.getByText('alpha'))
        fireEvent.click(screen.getByTestId('backup_verification_finish'))

        expect(mockMarkBackup).not.toHaveBeenCalled()
        expect(mockReplace).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
        expect(
            screen.getByText('backup.verification.error_message'),
        ).toBeTruthy()
    })
})
