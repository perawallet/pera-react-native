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

import { renderHook, act } from '@testing-library/react'
import { useImportAccountScreen } from '../useImportAccountScreen'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockShowToast = vi.fn()
const mockReplace = vi.fn()
const mockGoBack = vi.fn()

vi.mock('react-native', () => ({
    Keyboard: {
        addListener: vi.fn(() => ({
            remove: vi.fn(),
        })),
    },
    Platform: {
        OS: 'ios',
    },
}))

vi.mock('@react-navigation/native', () => ({
    useRoute: vi.fn(() => ({
        params: { accountType: 'hdWallet' },
    })),
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: vi.fn(() => ({
        replace: mockReplace,
        goBack: mockGoBack,
    })),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useImportAccount: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    MNEMONIC_WORDLIST: [
        'abandon',
        'ability',
        'able',
        'about',
        'above',
        'absent',
        'absorb',
        'abstract',
        'absurd',
        'abuse',
        'zoo',
    ],
}))

vi.mock('@hooks/useToast', () => ({
    useToast: vi.fn(() => ({
        showToast: mockShowToast,
    })),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: vi.fn(() => ({
        t: (key: string) => key,
    })),
}))

vi.mock('@hooks/useDeepLink', () => ({
    useDeepLink: vi.fn(() => ({
        parseDeeplink: vi.fn(),
    })),
}))

describe('useImportAccountScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('initializes with empty words', () => {
        const { result } = renderHook(() => useImportAccountScreen())
        expect(result.current.words).toHaveLength(24)
        expect(result.current.words.every(w => w === '')).toBe(true)
    })

    it('updates a single word at a specific index', () => {
        const { result } = renderHook(() => useImportAccountScreen())

        act(() => {
            result.current.updateWord('apple', 5)
        })

        expect(result.current.words[5]).toBe('apple')
    })

    it('fills all slots when a full mnemonic is pasted into any slot', () => {
        const { result } = renderHook(() => useImportAccountScreen())
        const mnemonic = new Array(24).fill('word').join(' ')

        act(() => {
            result.current.updateWord(mnemonic, 5)
        })

        expect(result.current.words.every(w => w === 'word')).toBe(true)
    })

    it('fills sequential slots when a partial mnemonic is pasted into any slot and fits', () => {
        const { result } = renderHook(() => useImportAccountScreen())
        const mnemonic = 'word1 word2 word3'

        act(() => {
            result.current.updateWord(mnemonic, 20)
        })

        expect(result.current.words[20]).toBe('word1')
        expect(result.current.words[21]).toBe('word2')
        expect(result.current.words[22]).toBe('word3')
        expect(result.current.words[23]).toBe('')
    })

    it('shows insufficient slots toast if partial mnemonic does not fit in remaining slots', () => {
        const { result } = renderHook(() => useImportAccountScreen())
        const mnemonic = 'word1 word2 word3'

        act(() => {
            result.current.updateWord(mnemonic, 22)
        })

        expect(mockShowToast).toHaveBeenCalledWith({
            title: 'onboarding.import_account.insufficient_slots_title',
            body: 'onboarding.import_account.insufficient_slots_body',
            type: 'error',
        })
        expect(result.current.words[22]).toBe('')
    })

    it('shows a toast and does not update words if too many words are pasted', () => {
        const { result } = renderHook(() => useImportAccountScreen())
        const mnemonic = new Array(25).fill('word').join(' ')

        act(() => {
            result.current.updateWord(mnemonic, 0)
        })

        expect(mockShowToast).toHaveBeenCalledWith({
            title: 'onboarding.import_account.invalid_mnemonic_title',
            body: 'onboarding.import_account.invalid_mnemonic_body',
            type: 'error',
        })
        expect(result.current.words[0]).toBe('')
    })

    it('treats spaces at the end of a single word as a single word update', () => {
        const { result } = renderHook(() => useImportAccountScreen())

        act(() => {
            result.current.updateWord('apple ', 0)
        })

        expect(result.current.words[0]).toBe('apple')
        expect(result.current.words[1]).toBe('')
    })

    it('shows error toast when handleQRScannerSuccess is called with invalid QR content', () => {
        const { result } = renderHook(() => useImportAccountScreen())

        act(() => {
            result.current.handleQRScannerSuccess('invalid-url')
        })

        expect(mockShowToast).toHaveBeenCalledWith({
            title: 'onboarding.import_account.invalid_mnemonic_title',
            body: 'onboarding.import_account.invalid_mnemonic_body',
            type: 'error',
        })
    })

    describe('suggestions', () => {
        it('returns empty suggestions when no prefix is typed', () => {
            const { result } = renderHook(() => useImportAccountScreen())

            expect(result.current.suggestions).toEqual([])
        })

        it('returns matching suggestions based on typed prefix', () => {
            const { result } = renderHook(() => useImportAccountScreen())

            act(() => {
                result.current.updateWord('ab', 0)
                result.current.setFocused(0)
            })

            expect(result.current.suggestions).toEqual([
                'abandon',
                'ability',
                'able',
                'about',
            ])
        })

        it('returns empty suggestions when word exactly matches a BIP39 word and is the only match', () => {
            const { result } = renderHook(() => useImportAccountScreen())

            act(() => {
                result.current.updateWord('zoo', 0)
                result.current.setFocused(0)
            })

            expect(result.current.suggestions).toEqual([])
        })

        it('limits suggestions to 4', () => {
            const { result } = renderHook(() => useImportAccountScreen())

            act(() => {
                result.current.updateWord('ab', 0)
                result.current.setFocused(0)
            })

            expect(result.current.suggestions.length).toBeLessThanOrEqual(4)
        })

        it('returns suggestions for the focused word only', () => {
            const { result } = renderHook(() => useImportAccountScreen())

            act(() => {
                result.current.updateWord('ab', 0)
                result.current.updateWord('zo', 1)
                result.current.setFocused(1)
            })

            expect(result.current.suggestions).toEqual(['zoo'])
        })
    })

    describe('handleSelectSuggestion', () => {
        it('fills the focused word with the selected suggestion', () => {
            const { result } = renderHook(() => useImportAccountScreen())

            act(() => {
                result.current.setFocused(5)
            })

            act(() => {
                result.current.handleSelectSuggestion('abandon')
            })

            expect(result.current.words[5]).toBe('abandon')
        })

        it('advances focused index to the next input after selection', () => {
            const { result } = renderHook(() => useImportAccountScreen())

            act(() => {
                result.current.setFocused(5)
            })

            act(() => {
                result.current.handleSelectSuggestion('abandon')
            })

            expect(result.current.focused).toBe(6)
        })

        it('does not advance past the last word index', () => {
            const { result } = renderHook(() => useImportAccountScreen())

            act(() => {
                result.current.setFocused(23)
            })

            act(() => {
                result.current.handleSelectSuggestion('abandon')
            })

            expect(result.current.words[23]).toBe('abandon')
            expect(result.current.focused).toBe(23)
        })
    })
})
