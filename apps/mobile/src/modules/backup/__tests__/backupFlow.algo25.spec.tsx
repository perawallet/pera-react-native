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
import { render, screen, fireEvent, waitFor } from '@test-utils/render'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useBackupStore } from '@perawallet/wallet-core-backup'

const account: WalletAccount = {
    type: AccountTypes.algo25,
    address: 'ADDR_A',
    keyPairId: 'kp-A',
    seedKeyId: 'seed-A',
}

const MNEMONIC_WORDS = ['alpha', 'bravo', 'charlie']

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

const mockReplace = vi.fn()
const mockNavigate = vi.fn()

vi.mock('@react-navigation/native', async importOriginal => {
    const original =
        await importOriginal<typeof import('@react-navigation/native')>()
    return {
        ...original,
        useNavigation: () => ({
            replace: mockReplace,
            navigate: mockNavigate,
        }),
        useRoute: () => ({ params: { address: account.address } }),
    }
})

vi.mock('../context', () => ({
    useBackupFlowWords: () => ({
        getWords: () => MNEMONIC_WORDS,
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

import { BackupVerificationScreen } from '../screens/BackupVerificationScreen'

describe('Backup flow - Algo25 end-to-end outcome', () => {
    beforeEach(() => {
        useBackupStore.getState().resetState()
        mockReplace.mockReset()
        mockNavigate.mockReset()
    })

    test('completing verification marks seedKeyId as backed up and navigates to success', async () => {
        render(<BackupVerificationScreen />)

        for (const word of MNEMONIC_WORDS) {
            fireEvent.click(screen.getByText(word))
        }

        fireEvent.click(screen.getByTestId('backup_verification_finish'))

        await waitFor(() => {
            expect(useBackupStore.getState().isBackedUp('seed-A')).toBe(true)
        })

        const allCalls = [...mockReplace.mock.calls, ...mockNavigate.mock.calls]
        const sawSuccess = allCalls.some(c => c[0] === 'BackupSuccess')
        expect(sawSuccess).toBe(true)
    })
})
