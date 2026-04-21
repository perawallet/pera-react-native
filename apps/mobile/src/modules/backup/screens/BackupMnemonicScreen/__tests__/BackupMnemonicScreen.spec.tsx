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
const mockGetWords = vi.fn()
const mockSetWords = vi.fn()

vi.mock('@react-navigation/native', async importOriginal => {
    const original =
        await importOriginal<typeof import('@react-navigation/native')>()
    return {
        ...original,
        useNavigation: () => ({ navigate: mockNavigate }),
        useRoute: () => ({ params: { address: 'ADDR' } }),
    }
})

vi.mock('../../../context', () => ({
    useBackupFlowWords: () => ({
        getWords: mockGetWords,
        setWords: mockSetWords,
        clearWords: vi.fn(),
    }),
}))

// Mock the screen-specific mnemonic-loader hook directly; this lets us
// bypass KMS session plumbing and focus on render + navigation behavior.
vi.mock('../useBackupMnemonicScreen', () => ({
    useBackupMnemonicScreen: () => ({
        words: 'alpha bravo charlie delta echo foxtrot'.split(' '),
        isLoading: false,
        error: null,
        onContinue: () => {
            mockSetWords([
                'alpha',
                'bravo',
                'charlie',
                'delta',
                'echo',
                'foxtrot',
            ])
            mockNavigate('BackupVerification', { address: 'ADDR' })
        },
    }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (k: string) => k }),
}))

import { BackupMnemonicScreen } from '../BackupMnemonicScreen'

describe('BackupMnemonicScreen', () => {
    beforeEach(() => {
        mockNavigate.mockReset()
        mockSetWords.mockReset()
        mockGetWords.mockReset()
    })

    test('renders each word of the mnemonic with its index', async () => {
        render(<BackupMnemonicScreen />)
        await waitFor(() => {
            expect(screen.getByText('alpha')).toBeTruthy()
            expect(screen.getByText('foxtrot')).toBeTruthy()
            expect(screen.getByText('1')).toBeTruthy()
            expect(screen.getByText('6')).toBeTruthy()
        })
    })

    test('pressing continue stores words and navigates to verification', async () => {
        render(<BackupMnemonicScreen />)
        await waitFor(() => screen.getByText('alpha'))
        fireEvent.click(screen.getByTestId('backup_mnemonic_continue'))
        expect(mockSetWords).toHaveBeenCalledWith([
            'alpha',
            'bravo',
            'charlie',
            'delta',
            'echo',
            'foxtrot',
        ])
        expect(mockNavigate).toHaveBeenCalledWith('BackupVerification', {
            address: 'ADDR',
        })
    })
})
