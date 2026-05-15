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
import * as Clipboard from 'expo-clipboard'
import { vi, describe, it, expect, beforeEach } from 'vitest'

import { useMnemonicWordEntry } from '../useMnemonicWordEntry'

vi.mock('expo-clipboard', () => ({
    getStringAsync: vi.fn(),
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
        'access',
        'accident',
        'school',
        'zoo',
    ],
}))

const TWELVE_WORDS = [
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
    'access',
    'accident',
]

const renderEntry = () => {
    const onTooManyWords = vi.fn()
    const onInsufficientSlots = vi.fn()
    const view = renderHook(() =>
        useMnemonicWordEntry({
            wordCount: 12,
            onTooManyWords,
            onInsufficientSlots,
        }),
    )
    return { ...view, onTooManyWords, onInsufficientSlots }
}

beforeEach(() => {
    vi.clearAllMocks()
    // Default to an empty clipboard so the paste fallback only kicks in for
    // tests that explicitly mock a value; otherwise `mockResolvedValue` set
    // by one test would leak into later ones and corrupt their state.
    vi.mocked(Clipboard.getStringAsync).mockResolvedValue('')
})

describe('useMnemonicWordEntry — paste distribution', () => {
    it('distributes a full N-word paste across all slots from any starting slot', async () => {
        const { result } = renderEntry()

        await act(async () => {
            await result.current.handleWordChange(TWELVE_WORDS.join(' '), 5)
        })

        expect(result.current.words).toEqual(TWELVE_WORDS)
    })

    it.each([
        ['comma-separated', TWELVE_WORDS.join(',')],
        ['comma + space', TWELVE_WORDS.join(', ')],
        ['mixed whitespace and commas', TWELVE_WORDS.join(' ,\n  ')],
    ])('accepts %s separators', async (_label, pasted) => {
        const { result } = renderEntry()

        await act(async () => {
            await result.current.handleWordChange(pasted, 0)
        })

        expect(result.current.words).toEqual(TWELVE_WORDS)
    })

    it('falls back to the clipboard when the keyboard collapses pasted whitespace', async () => {
        vi.mocked(Clipboard.getStringAsync).mockResolvedValue(
            TWELVE_WORDS.join('\n'),
        )

        const { result } = renderEntry()

        await act(async () => {
            await result.current.handleWordChange(TWELVE_WORDS.join(''), 0)
        })

        expect(Clipboard.getStringAsync).toHaveBeenCalled()
        expect(result.current.words).toEqual(TWELVE_WORDS)
    })

    it('does not consult the clipboard for short single-token inputs even if a mnemonic is on the clipboard', async () => {
        // Regression: iOS autocomplete delivers a whole word in one event,
        // which previously tripped the clipboard fallback and overwrote every
        // slot when the user had a mnemonic copied for any reason.
        vi.mocked(Clipboard.getStringAsync).mockResolvedValue(
            TWELVE_WORDS.join(' '),
        )

        const { result } = renderEntry()

        await act(async () => {
            // Whole word inserted in one shot — 7 chars, below the threshold.
            await result.current.handleWordChange('abandon', 0)
        })

        expect(Clipboard.getStringAsync).not.toHaveBeenCalled()
        expect(result.current.words[0]).toBe('abandon')
        expect(result.current.words.slice(1).every(w => w === '')).toBe(true)
    })

    it('fills sequential slots when a partial paste fits in the remaining inputs', async () => {
        const { result } = renderEntry()

        await act(async () => {
            await result.current.handleWordChange('abandon ability able', 2)
        })

        expect(result.current.words).toEqual([
            '',
            '',
            'abandon',
            'ability',
            'able',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
        ])
    })

    it('fires onTooManyWords when more words than the slot count are pasted', async () => {
        const { result, onTooManyWords } = renderEntry()

        await act(async () => {
            await result.current.handleWordChange(
                [...TWELVE_WORDS, 'zoo'].join(' '),
                0,
            )
        })

        expect(onTooManyWords).toHaveBeenCalledOnce()
        expect(result.current.words.every(w => w === '')).toBe(true)
    })

    it('fires onInsufficientSlots when a partial paste cannot fit', async () => {
        const { result, onInsufficientSlots } = renderEntry()

        await act(async () => {
            await result.current.handleWordChange(
                'abandon ability able about',
                10,
            )
        })

        expect(onInsufficientSlots).toHaveBeenCalledOnce()
        expect(result.current.words.every(w => w === '')).toBe(true)
    })

    it('writes a single typed character without consulting the clipboard', async () => {
        const { result } = renderEntry()

        await act(async () => {
            await result.current.handleWordChange('a', 0)
        })

        expect(Clipboard.getStringAsync).not.toHaveBeenCalled()
        expect(result.current.words[0]).toBe('a')
    })

    it('writes the typed value when the clipboard read throws', async () => {
        vi.mocked(Clipboard.getStringAsync).mockRejectedValue(
            new Error('denied'),
        )

        const { result } = renderEntry()

        await act(async () => {
            await result.current.handleWordChange('abandonability', 0)
        })

        expect(result.current.words[0]).toBe('abandonability')
    })
})

describe('useMnemonicWordEntry — suggestions', () => {
    it('returns wordlist matches that share the current prefix', async () => {
        const { result } = renderEntry()

        await act(async () => {
            await result.current.handleWordChange('ab', 0)
        })

        expect(result.current.suggestions).toEqual([
            'abandon',
            'ability',
            'able',
            'about',
        ])
    })

    it('hides the only suggestion once the slot holds a complete word', async () => {
        const { result } = renderEntry()

        await act(async () => {
            await result.current.handleWordChange('school', 0)
        })

        expect(result.current.suggestions).toEqual([])
    })

    it('returns an empty list while the current input is too short', async () => {
        const { result } = renderEntry()

        await act(async () => {
            await result.current.handleWordChange('a', 0)
        })

        expect(result.current.suggestions).toEqual([])
    })
})

describe('useMnemonicWordEntry — handleSelectSuggestion', () => {
    it('writes the suggestion into the focused slot and advances focus', async () => {
        const { result } = renderEntry()

        act(() => {
            result.current.setFocused(3)
        })

        act(() => {
            result.current.handleSelectSuggestion('abandon')
        })

        expect(result.current.words[3]).toBe('abandon')
        expect(result.current.focused).toBe(4)
    })

    it('does not advance focus past the last slot', async () => {
        const { result } = renderEntry()

        act(() => {
            result.current.setFocused(11)
        })

        act(() => {
            result.current.handleSelectSuggestion('abandon')
        })

        expect(result.current.words[11]).toBe('abandon')
        expect(result.current.focused).toBe(11)
    })
})
