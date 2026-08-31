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

const { navigateMock, requestMock, enableBackupMock } = vi.hoisted(() => ({
    navigateMock: vi.fn(),
    requestMock: vi.fn(),
    enableBackupMock: vi.fn(),
}))

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

vi.mock('@perawallet/wallet-core-kms', () => ({
    MNEMONIC_WORDLIST: ['alpha', 'bravo', 'charlie', 'delta'],
    mnemonicIndexToWord: (index: number) => MNEMONIC[index],
    pickDistinctIndexes: (count: number) =>
        Array.from({ length: count }, (_, i) => i),
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
    useNavigation: vi.fn(() => ({ navigate: navigateMock })),
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

beforeEach(() => {
    vi.clearAllMocks()
})

describe('useCloudBackupVerifyScreen', () => {
    test('builds a 3-word quiz from the draft index buffer', () => {
        renderHook(() => useCloudBackupVerifyScreen())

        const correctPairs = (useBackupQuiz as Mock).mock.calls[0][0]

        expect(correctPairs).toEqual([
            { index: 0, word: 'marble' },
            { index: 1, word: 'protect' },
            { index: 2, word: 'crawl' },
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
        expect(navigateMock).not.toHaveBeenCalled()
    })

    test("navigates to setup when the sheet resolves 'show-credentials'", async () => {
        requestMock.mockResolvedValue('show-credentials')
        renderHook(() => useCloudBackupVerifyScreen())
        const onSuccess = (useBackupQuiz as Mock).mock.calls[0][2]

        await act(async () => {
            await onSuccess()
        })

        expect(navigateMock).toHaveBeenCalledWith('CloudBackupSetup')
        expect(enableBackupMock).not.toHaveBeenCalled()
    })
})
