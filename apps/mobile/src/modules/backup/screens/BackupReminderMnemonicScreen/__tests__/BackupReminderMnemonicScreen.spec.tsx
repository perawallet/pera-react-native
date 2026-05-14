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

const mockNavigate = vi.fn()
const mockGoBack = vi.fn()
const mockCheckPinEnabled = vi.fn()
const mockAccount = {
    type: 'algo25' as const,
    address: 'ADDR',
    keyPairId: 'kp-1',
}

vi.mock('@react-navigation/native', async importOriginal => {
    const original =
        await importOriginal<typeof import('@react-navigation/native')>()
    return {
        ...original,
        useNavigation: () => ({
            navigate: mockNavigate,
            goBack: mockGoBack,
        }),
        useRoute: () => ({ params: { address: 'ADDR' } }),
    }
})

vi.mock('@perawallet/wallet-core-security', () => ({
    usePinCode: () => ({ checkPinEnabled: mockCheckPinEnabled }),
}))

vi.mock('expo-screen-capture', () => ({
    preventScreenCaptureAsync: vi.fn().mockResolvedValue(undefined),
    allowScreenCaptureAsync: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => {
    const original =
        await importOriginal<
            typeof import('@perawallet/wallet-core-accounts')
        >()
    return {
        ...original,
        useAccountsStore: (selector: (state: unknown) => unknown) =>
            selector({ accounts: [mockAccount] }),
    }
})

const MOCK_WORDS = 'alpha bravo charlie delta echo foxtrot'.split(' ')
const stableExecuteWithMnemonic = async <T,>(
    handler: (words: string[]) => T | Promise<T>,
): Promise<T> => handler(MOCK_WORDS)
const stableMnemonicHook = { executeWithMnemonic: stableExecuteWithMnemonic }

vi.mock('../../../hooks', () => ({
    useMnemonicForAddress: () => stableMnemonicHook,
}))

vi.mock('@modules/security', () => ({
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

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (k: string) => k }),
}))

import { BackupReminderMnemonicScreen } from '../BackupReminderMnemonicScreen'

describe('BackupReminderMnemonicScreen', () => {
    beforeEach(() => {
        mockNavigate.mockReset()
        mockGoBack.mockReset()
        mockCheckPinEnabled.mockReset()
    })

    test('does not reveal the mnemonic until the PIN gate resolves', async () => {
        mockCheckPinEnabled.mockResolvedValue(true)
        render(<BackupReminderMnemonicScreen />)
        await waitFor(() => {
            expect(screen.getByTestId('pin_modal')).toBeTruthy()
        })
        expect(screen.queryByText('alpha')).toBeNull()
    })

    test('reveals the mnemonic after PIN verification', async () => {
        mockCheckPinEnabled.mockResolvedValue(true)
        render(<BackupReminderMnemonicScreen />)
        await waitFor(() => screen.getByTestId('pin_success'))
        fireEvent.click(screen.getByTestId('pin_success'))
        await waitFor(() => {
            expect(screen.getByText('alpha')).toBeTruthy()
            expect(screen.getByText('foxtrot')).toBeTruthy()
        })
    })

    test('skips the PIN gate when no PIN is set', async () => {
        mockCheckPinEnabled.mockResolvedValue(false)
        render(<BackupReminderMnemonicScreen />)
        await waitFor(() => {
            expect(screen.getByText('alpha')).toBeTruthy()
        })
        expect(screen.queryByTestId('pin_modal')).toBeNull()
    })

    test('pressing continue navigates to verification', async () => {
        mockCheckPinEnabled.mockResolvedValue(false)
        render(<BackupReminderMnemonicScreen />)
        await waitFor(() => screen.getByText('alpha'))
        fireEvent.click(screen.getByTestId('backup_mnemonic_continue'))
        expect(mockNavigate).toHaveBeenCalledWith('BackupVerification', {
            address: 'ADDR',
        })
    })
})
