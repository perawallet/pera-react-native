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
import { trackEvent, CloudBackupEvent } from '@analytics'
import { useBackupQuiz } from '@modules/backup'
import { useCloudBackupVerifyScreen } from '../useCloudBackupVerifyScreen'

vi.mock('@analytics', async () => ({
    ...(await vi.importActual<object>('@analytics/events/contexts')),
    trackEvent: vi.fn(),
}))

type BeforeRemoveEvent = {
    data: { action: { type: string } }
    preventDefault: () => void
}

const { registerBackupMock, registerState, addListenerMock, setOptionsMock } =
    vi.hoisted(() => ({
        registerBackupMock: vi.fn(),
        registerState: { isRegistering: false },
        addListenerMock: vi.fn(
            (_event: string, _listener: (event: BeforeRemoveEvent) => void) =>
                vi.fn(),
        ),
        setOptionsMock: vi.fn(),
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

vi.mock('../../../hooks/useRegisterCloudBackup', () => ({
    useRegisterCloudBackup: () => ({
        registerBackup: registerBackupMock,
        isRegistering: registerState.isRegistering,
    }),
}))

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        addListener: addListenerMock,
        setOptions: setOptionsMock,
    }),
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
    registerState.isRegistering = false
})

const renderAndTakeBeforeRemoveListener = (): ((
    event: BeforeRemoveEvent,
) => void) => {
    renderHook(() => useCloudBackupVerifyScreen())
    const [eventName, listener] = addListenerMock.mock.calls[0]

    expect(eventName).toBe('beforeRemove')

    return listener
}

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

    test('tracks the proceed tap and forwards it to the quiz', () => {
        const quizSubmit = vi.fn()
        ;(useBackupQuiz as Mock).mockReturnValueOnce({
            items: [],
            onSelect: vi.fn(),
            onSubmit: quizSubmit,
            isFilled: true,
            hasError: false,
        })
        const { result } = renderHook(() => useCloudBackupVerifyScreen())

        result.current.onSubmit()

        expect(trackEvent).toHaveBeenCalledWith(CloudBackupEvent.VerifyProceed)
        expect(quizSubmit).toHaveBeenCalledTimes(1)
    })

    // Identity, not a call count: a sheet or PIN gate wrapping `registerBackup`
    // would still satisfy "was eventually called".
    test('registers the backup as soon as the quiz passes', () => {
        renderHook(() => useCloudBackupVerifyScreen())

        expect((useBackupQuiz as Mock).mock.calls[0][2]).toBe(
            registerBackupMock,
        )
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

    test('refuses a back action while the registration is in flight', () => {
        registerState.isRegistering = true
        const listener = renderAndTakeBeforeRemoveListener()
        const preventDefault = vi.fn()

        act(() =>
            listener({ data: { action: { type: 'GO_BACK' } }, preventDefault }),
        )

        expect(preventDefault).toHaveBeenCalled()
    })

    test('lets a back action through when no registration is in flight', () => {
        const listener = renderAndTakeBeforeRemoveListener()
        const preventDefault = vi.fn()

        act(() =>
            listener({ data: { action: { type: 'GO_BACK' } }, preventDefault }),
        )

        expect(preventDefault).not.toHaveBeenCalled()
    })

    // The success path navigates while `isRegistering` is still true, so a
    // guard that blocked every removal would strand the flow it protects.
    test('does not block the replace that follows a successful registration', () => {
        registerState.isRegistering = true
        const listener = renderAndTakeBeforeRemoveListener()
        const preventDefault = vi.fn()

        act(() =>
            listener({ data: { action: { type: 'REPLACE' } }, preventDefault }),
        )

        expect(preventDefault).not.toHaveBeenCalled()
    })

    test('drops the back affordances only while the registration is in flight', () => {
        const { rerender } = renderHook(() => useCloudBackupVerifyScreen())

        expect(setOptionsMock).toHaveBeenLastCalledWith({
            headerLeft: undefined,
            gestureEnabled: undefined,
        })

        registerState.isRegistering = true
        rerender()

        expect(setOptionsMock).toHaveBeenLastCalledWith({
            headerLeft: expect.any(Function),
            gestureEnabled: false,
        })
    })
})
