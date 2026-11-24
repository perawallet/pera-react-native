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

vi.mock('@perawallet/wallet-core-backup', () => ({
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
vi.mock('@perawallet/wallet-core-kms', () => ({
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

vi.mock('@modules/security', () => ({
    useRequirePinVerification: () => ({
        requirePinVerification: requirePinMock,
    }),
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

    test('accepts a key pasted with surrounding spaces', async () => {
        const { result } = await renderReady()
        act(() => result.current.handleKeyChange(`  ${SALT} `))

        act(() => quizCall()[2]())

        expect(result.current.encryptionKey).toBe(SALT)
        expect(confirmCredentialsMock).toHaveBeenCalledTimes(1)
    })

    test('reports the key and confirms nothing when the words are right and the key is wrong', async () => {
        const { result } = await renderReady()
        act(() => result.current.handleKeyChange('d3Jvbmc='))
        const before = quizCall()[0]

        act(() => quizCall()[2]())

        expect(errorToastMock).toHaveBeenCalledWith(
            'cloud_backup.confirm_credentials.error_key',
            '',
        )
        expect(errorHapticMock).toHaveBeenCalled()
        expect(confirmCredentialsMock).not.toHaveBeenCalled()
        expect(goBackMock).not.toHaveBeenCalled()
        expect(quizCall()[0]).toEqual(before)
    })

    test('reports the words and re-samples positions when the key is right and the words are wrong', async () => {
        const { result } = await renderReady()
        act(() => result.current.handleKeyChange(SALT))
        const before = quizCall()[0]

        act(() => quizCall()[3]())

        expect(errorToastMock).toHaveBeenCalledWith(
            'cloud_backup.confirm_credentials.error_words',
            '',
        )
        expect(confirmCredentialsMock).not.toHaveBeenCalled()
        await waitFor(() => expect(quizCall()[0]).not.toEqual(before))
    })

    test('reports both when the words and the key are wrong', async () => {
        const { result } = await renderReady()
        act(() => result.current.handleKeyChange('d3Jvbmc='))

        act(() => quizCall()[3]())

        expect(errorToastMock).toHaveBeenCalledWith(
            'cloud_backup.confirm_credentials.error_both',
            '',
        )
        expect(confirmCredentialsMock).not.toHaveBeenCalled()
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
