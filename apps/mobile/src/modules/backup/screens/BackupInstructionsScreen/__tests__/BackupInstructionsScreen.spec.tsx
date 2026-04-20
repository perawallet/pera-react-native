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
                'backup.instructions.title': 'Back up your passphrase',
                'backup.instructions.body':
                    'Your recovery passphrase is the only way to access your funds if you lose this device. Write it down on paper, store it somewhere safe, and never share it with anyone.',
                'backup.instructions.warning_no_screenshot':
                    'Do not screenshot.',
                'backup.instructions.warning_no_share':
                    'Do not share with anyone.',
                'backup.instructions.warning_offline': 'Store it offline.',
                'backup.instructions.cta_reveal': 'Reveal passphrase',
                'backup.instructions.cta_cancel': 'Cancel',
            }
            return translations[key] ?? key
        },
    }),
}))

// Mock PinEditView so the test doesn't need the full PIN UI stack.
// Render a lightweight stand-in that exposes onSuccess via a button.
vi.mock('@modules/security/components/PinEditView', () => ({
    PinEditView: ({
        mode,
        onSuccess,
    }: {
        mode?: string | null
        onSuccess?: () => void
    }) =>
        mode
            ? React.createElement(
                  'div',
                  { 'data-testid': 'pin_modal' },
                  React.createElement('button', {
                      'data-testid': 'pin_success',
                      onClick: onSuccess,
                  }),
              )
            : null,
}))

import { BackupInstructionsScreen } from '../BackupInstructionsScreen'

describe('BackupInstructionsScreen', () => {
    test('renders title, body and three warnings', () => {
        render(<BackupInstructionsScreen />)
        expect(screen.getByText('Back up your passphrase')).toBeTruthy()
        expect(screen.getByText('Do not screenshot.')).toBeTruthy()
        expect(screen.getByText('Do not share with anyone.')).toBeTruthy()
        expect(screen.getByText('Store it offline.')).toBeTruthy()
    })

    test('pressing "Reveal passphrase" opens the PIN modal', () => {
        render(<BackupInstructionsScreen />)
        fireEvent.click(screen.getByTestId('backup_instructions_reveal'))
        expect(screen.getByTestId('pin_modal')).toBeTruthy()
    })

    test('successful PIN navigates to BackupMnemonic with address param', () => {
        render(<BackupInstructionsScreen />)
        fireEvent.click(screen.getByTestId('backup_instructions_reveal'))
        fireEvent.click(screen.getByTestId('pin_success'))
        expect(mockNavigate).toHaveBeenCalledWith('BackupMnemonic', {
            address: 'ADDR',
        })
    })
})
