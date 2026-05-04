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
import { render, screen, fireEvent } from '@test-utils/render'
import { within } from '@testing-library/react'
import {
    AccountTypes,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'

const mockReplace = vi.fn()
const mockNavigate = vi.fn()
const mockMarkBackup = vi.fn()
const mockShowToast = vi.fn()

const account: WalletAccount = {
    type: AccountTypes.algo25,
    address: 'ADDR',
    keyPairId: 'kp',
}

const CORRECT_PAIRS = [
    { index: 3, word: 'alpha' },
    { index: 7, word: 'bravo' },
    { index: 11, word: 'charlie' },
]

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
    useMarkMnemonicBackupComplete: () => mockMarkBackup,
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    MNEMONIC_WORDLIST: [
        'delta',
        'echo',
        'foxtrot',
        'golf',
        'hotel',
        'india',
        'juliet',
        'kilo',
        'lima',
        'mike',
    ],
    uniformIntBelow: (max: number) =>
        max <= 0 ? 0 : Math.floor(Math.random() * max),
    zeroBytes: (...buffers: Array<Uint8Array | null | undefined>) => {
        for (const buf of buffers) {
            if (buf) buf.fill(0)
        }
    },
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

vi.mock('../../../hooks', async importOriginal => {
    const original = await importOriginal<typeof import('../../../hooks')>()
    return {
        ...original,
        useRandomMnemonicForAddress: () => ({
            picks: [
                { index: 3, word: 'alpha' },
                { index: 7, word: 'bravo' },
                { index: 11, word: 'charlie' },
            ],
            isLoading: false,
            error: null,
        }),
    }
})

vi.mock('expo-haptics', () => ({
    notificationAsync: vi.fn(),
    NotificationFeedbackType: { Error: 'error' },
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        t: (key: string, params?: Record<string, unknown>) => {
            if (
                key === 'backup.verification.select_word' &&
                params?.number !== undefined
            ) {
                return `Select word #${params.number}`
            }
            return key
        },
    }),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mockShowToast }),
}))

import { BackupVerificationScreen } from '../BackupVerificationScreen'

type QuizItemInfo = {
    itemIndex: number
    position: number
    correctWord: string
    optionWords: string[]
}

const readQuizItems = (): QuizItemInfo[] => {
    const labels = screen.getAllByText(/^Select word #\d+$/)
    return labels.map((node, i) => {
        const text = (node as HTMLElement).textContent ?? ''
        const match = /#(\d+)/.exec(text)
        const position = match ? Number(match[1]) - 1 : 0
        const correctPair = CORRECT_PAIRS.find(p => p.index === position)
        const itemEl = screen.getByTestId(
            `backup_verification_item_${i}`,
        ) as HTMLElement
        const optionButtons = within(itemEl).getAllByRole('button')
        const optionWords = optionButtons.map(btn => {
            const tid =
                btn.getAttribute('data-testid') ?? btn.getAttribute('testid')
            const m = /_option_(.+)$/.exec(tid ?? '')
            return m ? m[1] : ''
        })
        return {
            itemIndex: i,
            position,
            correctWord: correctPair?.word ?? '',
            optionWords,
        }
    })
}

const answerAllCorrect = () => {
    readQuizItems().forEach(({ itemIndex, correctWord }) => {
        fireEvent.click(
            screen.getByTestId(
                `backup_verification_item_${itemIndex}_option_${correctWord}`,
            ),
        )
    })
}

const answerAllWrong = () => {
    readQuizItems().forEach(({ itemIndex, correctWord, optionWords }) => {
        const wrong = optionWords.find(w => w !== correctWord) ?? correctWord
        fireEvent.click(
            screen.getByTestId(
                `backup_verification_item_${itemIndex}_option_${wrong}`,
            ),
        )
    })
}

describe('BackupVerificationScreen', () => {
    beforeEach(() => {
        mockReplace.mockReset()
        mockNavigate.mockReset()
        mockMarkBackup.mockReset()
        mockShowToast.mockReset()
    })

    test('submitting correct answers marks backup complete and navigates to success', () => {
        render(<BackupVerificationScreen />)
        answerAllCorrect()
        fireEvent.click(screen.getByTestId('backup_verification_next'))

        expect(mockMarkBackup).toHaveBeenCalledWith(account)
        const navCall = mockReplace.mock.calls[0] ?? mockNavigate.mock.calls[0]
        expect(navCall?.[0]).toBe('BackupSuccess')
    })

    test('submitting wrong answers shows error toast and does NOT navigate', () => {
        render(<BackupVerificationScreen />)
        answerAllWrong()
        fireEvent.click(screen.getByTestId('backup_verification_next'))

        expect(mockMarkBackup).not.toHaveBeenCalled()
        expect(mockReplace).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
        expect(mockShowToast).toHaveBeenCalled()
    })
})
