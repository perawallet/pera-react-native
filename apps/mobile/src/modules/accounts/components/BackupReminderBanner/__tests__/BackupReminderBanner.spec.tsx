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

import { describe, test, expect, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent } from '@test-utils/render'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

const mockUseHook = vi.fn()
vi.mock('../useBackupReminderBanner', () => ({
    useBackupReminderBanner: (account: WalletAccount) => mockUseHook(account),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                'backup.banner.title': 'Back up your passphrase',
                'backup.banner.body':
                    "You could lose access to this account's funds forever if your device is lost or stolen.",
                'backup.banner.cta': 'Back up now',
            }
            return translations[key] ?? key
        },
    }),
}))

import { BackupReminderBanner } from '../BackupReminderBanner'

const account: WalletAccount = {
    type: AccountTypes.algo25,
    address: 'A',
    keyPairId: 'kp',
}

describe('BackupReminderBanner', () => {
    test('renders nothing when isVisible is false', () => {
        mockUseHook.mockReturnValue({ isVisible: false, onPress: vi.fn() })
        const { queryByTestId } = render(
            <BackupReminderBanner account={account} />,
        )
        expect(queryByTestId('backup_reminder_banner')).toBeNull()
    })

    test('renders title, body and CTA when isVisible is true', () => {
        mockUseHook.mockReturnValue({ isVisible: true, onPress: vi.fn() })
        render(<BackupReminderBanner account={account} />)

        expect(screen.getByText('Back up your passphrase')).toBeTruthy()
        expect(screen.getByText('Back up now')).toBeTruthy()
    })

    test('calls onPress when CTA is pressed', () => {
        const onPress = vi.fn()
        mockUseHook.mockReturnValue({ isVisible: true, onPress })
        render(<BackupReminderBanner account={account} />)

        fireEvent.click(screen.getByTestId('backup_reminder_banner_cta'))
        expect(onPress).toHaveBeenCalledTimes(1)
    })
})
