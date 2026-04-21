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

import React from 'react'
import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@test-utils/render'

vi.mock('@assets/icons/shield-check.svg', () => ({
    default: (props: React.SVGProps<SVGSVGElement>) =>
        React.createElement('div', {
            ...props,
            'data-testid': 'shield-check-svg',
        }),
}))

const mockNavigate = vi.fn()
vi.mock('@react-navigation/native', async importOriginal => {
    const original =
        await importOriginal<typeof import('@react-navigation/native')>()
    return {
        ...original,
        useNavigation: () => ({ navigate: mockNavigate }),
        useRoute: () => ({ params: { address: 'ADDR' } }),
    }
})

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string) => {
            const translations: Record<string, string> = {
                'backup.info.title':
                    'Create a passphrase backup for your account',
                'backup.info.body':
                    'Creating a passphrase backup will allow you to recover your account. Without the passphrase, if you lose your device, remove the account or delete the app, you can permanently lose access to your Algorand account!',
                'backup.info.cta': 'I Understand',
            }
            return translations[key] ?? key
        },
    }),
}))

import { BackupInfoScreen } from '../BackupInfoScreen'

describe('BackupInfoScreen', () => {
    test('renders title, body and CTA', () => {
        render(<BackupInfoScreen />)
        expect(
            screen.getByText('Create a passphrase backup for your account'),
        ).toBeTruthy()
        expect(screen.getByText(/Creating a passphrase backup/)).toBeTruthy()
        expect(screen.getByText('I Understand')).toBeTruthy()
    })

    test('pressing "I Understand" navigates to BackupWriteDown with address', () => {
        render(<BackupInfoScreen />)
        fireEvent.click(screen.getByTestId('backup_info_continue'))
        expect(mockNavigate).toHaveBeenCalledWith('BackupWriteDown', {
            address: 'ADDR',
        })
    })
})
