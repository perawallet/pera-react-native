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

vi.mock('@assets/icons/edit-pen.svg', () => ({
    default: (props: React.SVGProps<SVGSVGElement>) =>
        React.createElement('div', { ...props, 'data-testid': 'edit-pen-svg' }),
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
                'backup.write_down.title':
                    'Prepare to write down your recovery passphrase',
                'backup.write_down.body':
                    'The only way to recover an Algorand account is with this recovery passphrase.',
                'backup.write_down.warning':
                    'Do not share this passphrase with anyone, as it grants full access to your account.',
                'backup.write_down.cta': "I'm Ready to Begin",
            }
            return translations[key] ?? key
        },
    }),
}))

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

const mockCheckPinEnabled = vi.fn()
vi.mock('@perawallet/wallet-core-security', () => ({
    usePinCode: () => ({ checkPinEnabled: mockCheckPinEnabled }),
}))

import { BackupWriteDownScreen } from '../BackupWriteDownScreen'

describe('BackupWriteDownScreen', () => {
    beforeEach(() => {
        mockNavigate.mockReset()
        mockCheckPinEnabled.mockReset()
    })

    test('renders title, body and warning', () => {
        mockCheckPinEnabled.mockResolvedValue(true)
        render(<BackupWriteDownScreen />)
        expect(
            screen.getByText('Prepare to write down your recovery passphrase'),
        ).toBeTruthy()
        expect(
            screen.getByText(
                'The only way to recover an Algorand account is with this recovery passphrase.',
            ),
        ).toBeTruthy()
        expect(screen.getByText(/Do not share this passphrase/)).toBeTruthy()
    })

    test('when a PIN is set, pressing CTA opens the PIN modal', async () => {
        mockCheckPinEnabled.mockResolvedValue(true)
        render(<BackupWriteDownScreen />)
        fireEvent.click(screen.getByTestId('backup_write_down_begin'))
        await waitFor(() => {
            expect(screen.getByTestId('pin_modal')).toBeTruthy()
        })
    })

    test('when a PIN is set, successful verification navigates to BackupMnemonic', async () => {
        mockCheckPinEnabled.mockResolvedValue(true)
        render(<BackupWriteDownScreen />)
        fireEvent.click(screen.getByTestId('backup_write_down_begin'))
        await waitFor(() => screen.getByTestId('pin_success'))
        fireEvent.click(screen.getByTestId('pin_success'))
        expect(mockNavigate).toHaveBeenCalledWith('BackupMnemonic', {
            address: 'ADDR',
        })
    })

    test('when no PIN is set, pressing CTA skips the modal and navigates directly', async () => {
        mockCheckPinEnabled.mockResolvedValue(false)
        render(<BackupWriteDownScreen />)
        fireEvent.click(screen.getByTestId('backup_write_down_begin'))
        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('BackupMnemonic', {
                address: 'ADDR',
            })
        })
        expect(screen.queryByTestId('pin_modal')).toBeNull()
    })
})
