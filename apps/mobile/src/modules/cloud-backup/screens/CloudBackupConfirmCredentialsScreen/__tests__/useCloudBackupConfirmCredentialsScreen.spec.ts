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
import { renderHook, act, waitFor } from '@testing-library/react'
import { useBackupQuiz } from '@modules/backup'
import { useCloudBackupConfirmCredentialsScreen } from '../useCloudBackupConfirmCredentialsScreen'

const SALT = 'c2FsdC1mb3ItdGVzdA=='

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

const MNEMONIC_INDICES = Uint16Array.from(MNEMONIC.map((_, i) => i))

const {
    MockParseError,
    goBackMock,
    confirmCredentialsMock,
    requirePinMock,
    withIndicesMock,
    errorToastMock,
    successToastMock,
    errorHapticMock,
    storeState,
    pickState,
} = vi.hoisted(() => ({
    MockParseError: class MockParseError extends Error {},
    goBackMock: vi.fn(),
    confirmCredentialsMock: vi.fn(),
    requirePinMock: vi.fn(),
    withIndicesMock: vi.fn(),
    errorToastMock: vi.fn(),
    successToastMock: vi.fn(),
    errorHapticMock: vi.fn(),
    storeState: { salt: null as string | null },
    pickState: { calls: 0 },
}))

vi.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ goBack: goBackMock }),
}))

vi.mock('@perawallet/wallet-core-backup', async importOriginal => ({
    ...(await importOriginal<object>()),
    BackupMnemonicParseError: MockParseError,
    withBackupMnemonicIndices: withIndicesMock,
    useCloudBackupStore: (
        selector: (state: {
            salt: string | null
            confirmCredentials: () => void
        }) => unknown,
    ) =>
        selector({
            salt: storeState.salt,
            confirmCredentials: confirmCredentialsMock,
        }),
}))

// Advances one position per call so a re-sample is observable.
vi.mock('@perawallet/wallet-core-kms', async importOriginal => ({
    ...(await importOriginal<object>()),
    MNEMONIC_WORDLIST: ['alpha', 'bravo', 'charlie', 'delta'],
    mnemonicIndexToWord: (index: number) => MNEMONIC[index],
    pickDistinctIndexes: (count: number) =>
        Array.from({ length: count }, (_, i) => i + pickState.calls++),
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

// The real gate runs against a stubbed prompt, so declining still navigates back.
vi.mock('@modules/security/hooks/useRequirePinVerification', () => ({
    useRequirePinVerification: () => ({
        requirePinVerification: requirePinMock,
    }),
}))

vi.mock('@modules/security', async () => ({
    usePinGatedScreen: (
        await vi.importActual<
            typeof import('@modules/security/hooks/usePinGatedScreen')
        >('@modules/security/hooks/usePinGatedScreen')
    ).usePinGatedScreen,
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({
        errorToast: errorToastMock,
        successToast: successToastMock,
    }),
}))

vi.mock('@hooks/useHaptics', () => ({
    useHaptics: () => ({ error: errorHapticMock }),
}))

vi.mock('@hooks/useLanguage')

const quizCall = () => {
    const calls = (useBackupQuiz as Mock).mock.calls
    return calls[calls.length - 1] as [
        { index: number; word: string }[],
        string[],
        () => void,
        () => void,
    ]
}

const renderReady = async () => {
    const rendered = renderHook(() => useCloudBackupConfirmCredentialsScreen())
    await waitFor(() =>
        expect(rendered.result.current.passphraseStatus).toBe('ready'),
    )
    return rendered
}

beforeEach(() => {
    vi.clearAllMocks()
    pickState.calls = 0
    storeState.salt = SALT
    ;(useBackupQuiz as Mock).mockReturnValue({
        items: [],
        onSelect: vi.fn(),
        onSubmit: vi.fn(),
        isFilled: false,
        hasError: false,
    })
    requirePinMock.mockResolvedValue(true)
    withIndicesMock.mockImplementation(
        async (handler: (indices: Uint16Array) => void) => {
            handler(MNEMONIC_INDICES)
            return true
        },
    )
})

describe('useCloudBackupConfirmCredentialsScreen', () => {
    test('does not read the stored phrase until the PIN passes', async () => {
        let resolvePin: (value: boolean) => void = () => {}
        requirePinMock.mockReturnValue(
            new Promise<boolean>(resolve => {
                resolvePin = resolve
            }),
        )

        renderHook(() => useCloudBackupConfirmCredentialsScreen())

        expect(withIndicesMock).not.toHaveBeenCalled()

        await act(async () => resolvePin(true))

        await waitFor(() => expect(withIndicesMock).toHaveBeenCalledTimes(1))
    })

    test('goes back without reading the phrase when the PIN is declined', async () => {
        requirePinMock.mockResolvedValue(false)

        renderHook(() => useCloudBackupConfirmCredentialsScreen())

        await waitFor(() => expect(goBackMock).toHaveBeenCalledTimes(1))
        expect(withIndicesMock).not.toHaveBeenCalled()
    })

    test('asks about three words resolved from the stored phrase', async () => {
        await renderReady()

        expect(quizCall()[0]).toEqual([
            { index: 0, word: 'marble' },
            { index: 2, word: 'crawl' },
            { index: 4, word: 'lion' },
        ])
    })

    test('confirms, toasts and goes back when the words and the key are right', async () => {
        const { result } = await renderReady()
        act(() => result.current.handleKeyChange(SALT))

        act(() => quizCall()[2]())

        expect(confirmCredentialsMock).toHaveBeenCalledTimes(1)
        expect(successToastMock).toHaveBeenCalledWith(
            'cloud_backup.confirm_credentials.success',
            '',
        )
        expect(goBackMock).toHaveBeenCalledTimes(1)
    })

    test('a second confirm tap after success does nothing more', async () => {
        const { result } = await renderReady()
        act(() => result.current.handleKeyChange(SALT))

        act(() => quizCall()[2]())
        act(() => quizCall()[2]())

        expect(confirmCredentialsMock).toHaveBeenCalledTimes(1)
        expect(successToastMock).toHaveBeenCalledTimes(1)
        expect(goBackMock).toHaveBeenCalledTimes(1)
    })

    test('accepts a key wrapped across lines', async () => {
        const { result } = await renderReady()
        act(() =>
            result.current.handleKeyChange(
                `\n${SALT.slice(0, 8)}\n${SALT.slice(8)}\n`,
            ),
        )

        act(() => quizCall()[2]())

        expect(result.current.encryptionKey).toBe(SALT)
        expect(confirmCredentialsMock).toHaveBeenCalledTimes(1)
    })

    test('shows the key error and confirms nothing when the words are right and the key is wrong', async () => {
        const { result } = await renderReady()
        act(() => result.current.handleKeyChange('d3Jvbmc='))
        const before = quizCall()[0]

        act(() => quizCall()[2]())

        expect(result.current.keyError).toBe(
            'cloud_backup.confirm_credentials.error_key',
        )
        expect(result.current.wordsError).toBeNull()
        expect(errorToastMock).not.toHaveBeenCalled()
        expect(errorHapticMock).toHaveBeenCalled()
        expect(confirmCredentialsMock).not.toHaveBeenCalled()
        expect(goBackMock).not.toHaveBeenCalled()
        expect(quizCall()[0]).toEqual(before)
    })

    test('shows the words error and re-samples positions when the key is right and the words are wrong', async () => {
        const { result } = await renderReady()
        act(() => result.current.handleKeyChange(SALT))
        const before = quizCall()[0]

        act(() => quizCall()[3]())

        expect(result.current.wordsError).toBe(
            'cloud_backup.confirm_credentials.error_words',
        )
        expect(result.current.keyError).toBeNull()
        expect(errorToastMock).not.toHaveBeenCalled()
        expect(confirmCredentialsMock).not.toHaveBeenCalled()
        await waitFor(() => expect(quizCall()[0]).not.toEqual(before))
    })

    test('hides the quiz and blocks confirm until the re-sampled positions land', async () => {
        ;(useBackupQuiz as Mock).mockReturnValue({
            items: [],
            onSelect: vi.fn(),
            onSubmit: vi.fn(),
            isFilled: true,
            hasError: false,
        })
        const { result } = await renderReady()
        act(() => result.current.handleKeyChange(SALT))
        let finishReread: () => void = () => {}
        withIndicesMock.mockImplementationOnce(
            (handler: (indices: Uint16Array) => void) =>
                new Promise(resolve => {
                    finishReread = () => {
                        handler(MNEMONIC_INDICES)
                        resolve(true)
                    }
                }),
        )

        act(() => quizCall()[3]())

        expect(result.current.passphraseStatus).toBe('loading')
        expect(result.current.canConfirm).toBe(false)

        await act(async () => finishReread())

        expect(result.current.passphraseStatus).toBe('ready')
        expect(result.current.canConfirm).toBe(true)
    })

    test('shows both errors when the words and the key are wrong', async () => {
        const { result } = await renderReady()
        act(() => result.current.handleKeyChange('d3Jvbmc='))

        act(() => quizCall()[3]())

        expect(result.current.wordsError).not.toBeNull()
        expect(result.current.keyError).not.toBeNull()
        expect(errorToastMock).not.toHaveBeenCalled()
        expect(confirmCredentialsMock).not.toHaveBeenCalled()
    })

    test('editing the key clears only the key error', async () => {
        const { result } = await renderReady()
        act(() => result.current.handleKeyChange('d3Jvbmc='))
        act(() => quizCall()[3]())

        act(() => result.current.handleKeyChange(SALT))

        expect(result.current.keyError).toBeNull()
        expect(result.current.wordsError).not.toBeNull()
    })

    test('picking a word clears only the words error and reaches the quiz', async () => {
        const quizOnSelect = vi.fn()
        ;(useBackupQuiz as Mock).mockReturnValue({
            items: [],
            onSelect: quizOnSelect,
            onSubmit: vi.fn(),
            isFilled: false,
            hasError: false,
        })
        const { result } = await renderReady()
        act(() => result.current.handleKeyChange('d3Jvbmc='))
        act(() => quizCall()[3]())

        act(() => result.current.onSelect(0, 'alpha'))

        expect(result.current.wordsError).toBeNull()
        expect(result.current.keyError).not.toBeNull()
        expect(quizOnSelect).toHaveBeenCalledWith(0, 'alpha')
    })

    test('hints at the words while any is unpicked, then at the key, then nothing', async () => {
        const { result, rerender } = await renderReady()

        expect(result.current.confirmHint).toBe(
            'cloud_backup.confirm_credentials.hint_words',
        )

        ;(useBackupQuiz as Mock).mockReturnValue({
            items: [],
            onSelect: vi.fn(),
            onSubmit: vi.fn(),
            isFilled: true,
            hasError: false,
        })
        rerender()

        expect(result.current.confirmHint).toBe(
            'cloud_backup.confirm_credentials.hint_key',
        )

        act(() => result.current.handleKeyChange(SALT))

        expect(result.current.confirmHint).toBeNull()
    })

    test('shows no hint when the phrase is unavailable', async () => {
        withIndicesMock.mockResolvedValue(null)

        const { result } = renderHook(() =>
            useCloudBackupConfirmCredentialsScreen(),
        )
        await waitFor(() =>
            expect(result.current.passphraseStatus).toBe('unavailable'),
        )

        expect(result.current.confirmHint).toBeNull()
    })

    test('is unavailable and cannot confirm when nothing is stored', async () => {
        withIndicesMock.mockResolvedValue(null)
        ;(useBackupQuiz as Mock).mockReturnValue({
            items: [],
            onSelect: vi.fn(),
            onSubmit: vi.fn(),
            isFilled: true,
            hasError: false,
        })

        const { result } = renderHook(() =>
            useCloudBackupConfirmCredentialsScreen(),
        )
        await waitFor(() =>
            expect(result.current.passphraseStatus).toBe('unavailable'),
        )
        act(() => result.current.handleKeyChange(SALT))

        expect(result.current.canConfirm).toBe(false)
    })

    test('is unreadable when the stored phrase cannot be decoded', async () => {
        withIndicesMock.mockRejectedValue(new MockParseError('bad'))

        const { result } = renderHook(() =>
            useCloudBackupConfirmCredentialsScreen(),
        )

        await waitFor(() =>
            expect(result.current.passphraseStatus).toBe('unreadable'),
        )
        expect(result.current.canConfirm).toBe(false)
    })

    test('can confirm only with every word chosen and a key typed', async () => {
        ;(useBackupQuiz as Mock).mockReturnValue({
            items: [],
            onSelect: vi.fn(),
            onSubmit: vi.fn(),
            isFilled: true,
            hasError: false,
        })
        const { result } = await renderReady()

        expect(result.current.canConfirm).toBe(false)

        act(() => result.current.handleKeyChange(SALT))

        expect(result.current.canConfirm).toBe(true)
    })
})
