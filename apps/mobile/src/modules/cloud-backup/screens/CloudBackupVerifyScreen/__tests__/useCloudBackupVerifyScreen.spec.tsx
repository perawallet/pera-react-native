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

import { describe, test, expect, vi, beforeEach, type Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBackupQuiz } from '@modules/backup'
import { useCloudBackupVerifyScreen } from '../useCloudBackupVerifyScreen'

const { navigateMock, popToMock, requestMock, enableBackupMock } = vi.hoisted(
    () => ({
        navigateMock: vi.fn(),
        popToMock: vi.fn(),
        requestMock: vi.fn(),
        enableBackupMock: vi.fn(),
    }),
)

const MNEMONIC = [
    'marble',
    'protect',
    'crawl',
    'steak',
    'lion',
    'clock',
    'enemy',
    'milk',
    'venue',
    'cereal',
    'roast',
    'wealth',
]

// Stand-in wordlist indices: the mock `mnemonicIndexToWord` below maps each
// index back to MNEMONIC, so the quiz assertions stay readable as words.
const MNEMONIC_INDICES = Uint16Array.from(MNEMONIC.map((_, i) => i))

vi.mock('@perawallet/wallet-core-backup', () => ({
    useCloudBackupDraftStore: vi.fn(
        (selector: (s: { mnemonicIndices: Uint16Array | null }) => unknown) =>
            selector({ mnemonicIndices: MNEMONIC_INDICES }),
    ),
}))

// Advances one position per call so a re-sample is observable: call 1 asks
// about words 1-3, call 2 about words 2-4, and so on.
let pickCallCount = 0
vi.mock('@perawallet/wallet-core-kms', () => ({
    MNEMONIC_WORDLIST: ['alpha', 'bravo', 'charlie', 'delta'],
    mnemonicIndexToWord: (index: number) => MNEMONIC[index],
    pickDistinctIndexes: (count: number) =>
        Array.from({ length: count }, (_, i) => i + pickCallCount++),
}))

vi.mock('@modules/backup', () => ({
    useBackupQuiz: vi.fn(() => ({
        items: [],
        onSelect: vi.fn(),
        onSubmit: vi.fn(),
        isFilled: false,
        hasError: false,
    })),
}))

vi.mock('@react-navigation/native', () => ({
    useNavigation: vi.fn(() => ({ navigate: navigateMock, popTo: popToMock })),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: vi.fn(() => ({ request: requestMock })),
}))

vi.mock('../../../hooks', () => ({
    useEnableCloudBackup: vi.fn(() => ({
        enableBackup: enableBackupMock,
        isEnabling: false,
    })),
}))

vi.mock('../../components/EncryptionKeyConfirmSheet', () => ({
    EncryptionKeyConfirmSheet: () => null,
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: vi.fn() }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('expo-haptics', () => ({
    notificationAsync: vi.fn(),
    NotificationFeedbackType: { Error: 'error' },
}))

beforeEach(() => {
    vi.clearAllMocks()
    pickCallCount = 0
})

describe('useCloudBackupVerifyScreen', () => {
    test('builds a 3-word quiz from the draft index buffer', () => {
        renderHook(() => useCloudBackupVerifyScreen())

        const correctPairs = (useBackupQuiz as Mock).mock.calls[0][0]

        expect(correctPairs).toEqual([
            { index: 0, word: 'marble' },
            { index: 2, word: 'crawl' },
            { index: 4, word: 'lion' },
        ])
    })

    test('forwards the quiz state from useBackupQuiz', () => {
        ;(useBackupQuiz as Mock).mockReturnValueOnce({
            items: [{ position: 0, options: [], selectedWord: null }],
            onSelect: vi.fn(),
            onSubmit: vi.fn(),
            isFilled: true,
            hasError: false,
        })

        const { result } = renderHook(() => useCloudBackupVerifyScreen())

        expect(result.current.isFilled).toBe(true)
        expect(result.current.items).toHaveLength(1)
    })

    test("enables cloud backup when the confirm sheet resolves 'enable'", async () => {
        requestMock.mockResolvedValue('enable')
        renderHook(() => useCloudBackupVerifyScreen())
        const onSuccess = (useBackupQuiz as Mock).mock.calls[0][2]

        await act(async () => {
            await onSuccess()
        })

        expect(enableBackupMock).toHaveBeenCalledTimes(1)
        expect(popToMock).not.toHaveBeenCalled()
    })

    // `popTo`, not `navigate`: navigate would push a second Setup screen, which
    // regenerates the credentials the user asked to see again.
    test("pops back to setup when the sheet resolves 'show-credentials'", async () => {
        requestMock.mockResolvedValue('show-credentials')
        renderHook(() => useCloudBackupVerifyScreen())
        const onSuccess = (useBackupQuiz as Mock).mock.calls[0][2]

        await act(async () => {
            await onSuccess()
        })

        expect(popToMock).toHaveBeenCalledWith('CloudBackupSetup')
        expect(navigateMock).not.toHaveBeenCalled()
        expect(enableBackupMock).not.toHaveBeenCalled()
    })

    // Fixed positions leave a 27-combination quiz that can be ground through
    // without ever having stored the phrase.
    test('re-samples the asked positions after a wrong answer', () => {
        renderHook(() => useCloudBackupVerifyScreen())
        const calls = (useBackupQuiz as Mock).mock.calls
        const before = calls[0][0]
        const onWrong = calls[0][3]

        act(() => {
            onWrong()
        })

        const after = calls[calls.length - 1][0]
        expect(after).not.toEqual(before)
        expect(after.map((p: { index: number }) => p.index)).not.toEqual(
            before.map((p: { index: number }) => p.index),
        )
    })
})
