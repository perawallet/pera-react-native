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

import { renderHook, act } from '@testing-library/react'
import { Keyboard } from 'react-native'
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

    it('dismisses the keyboard once a complete mnemonic is filled', async () => {
        const dismissSpy = vi.spyOn(Keyboard, 'dismiss')
        const { result } = renderEntry()

        await act(async () => {
            await result.current.handleWordChange(TWELVE_WORDS.join(' '), 0)
        })

        expect(dismissSpy).toHaveBeenCalled()
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

    it('treats a single wordlist token with trailing punctuation as autocomplete, not a paste', async () => {
        // Regression: some keyboards append a trailing comma/period when
        // accepting a suggestion. Without normalizing through splitMnemonic,
        // the wordlist check missed the trailing punctuation, the clipboard
        // fallback engaged, and a copied mnemonic overwrote every slot.
        vi.mocked(Clipboard.getStringAsync).mockResolvedValue(
            TWELVE_WORDS.join(' '),
        )

        const { result } = renderEntry()

        await act(async () => {
            await result.current.handleWordChange('abandon,', 0)
        })

        expect(Clipboard.getStringAsync).not.toHaveBeenCalled()
        // The slot holds the normalised token (comma stripped by
        // splitMnemonic) so the user doesn't have to clean it up before
        // Continue enables; and the other 11 slots stay empty rather than
        // being clobbered by the clipboard mnemonic.
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

describe('useMnemonicWordEntry — unmount cleanup', () => {
    it('scrubs the retained slot indices on unmount', async () => {
        const { result, unmount } = renderEntry()

        await act(async () => {
            await result.current.handleWordChange(TWELVE_WORDS.join(' '), 0)
        })

        expect(result.current.words).toEqual(TWELVE_WORDS)
        const getMnemonicIndices = result.current.getMnemonicIndices
        expect(getMnemonicIndices()!.some(index => index !== 0)).toBe(true)

        unmount()

        // The slot objects are scrubbed in place, so the retained indices all
        // read zero after unmount. (The derived `words` array snapshot holds
        // interned wordlist constants — nothing user-typed to wipe there.)
        expect(Array.from(getMnemonicIndices()!)).toEqual(new Array(12).fill(0))
    })
})

describe('useMnemonicWordEntry — getMnemonicIndices', () => {
    it('returns the wordlist indices once every slot holds a valid word', async () => {
        const { result } = renderEntry()

        await act(async () => {
            await result.current.handleWordChange(TWELVE_WORDS.join(' '), 0)
        })

        // The spec's mocked wordlist is ordered, so indices are positions.
        expect(Array.from(result.current.getMnemonicIndices()!)).toEqual(
            TWELVE_WORDS.map((_, i) => i),
        )
    })

    it('returns null while any slot is empty or not a wordlist word', async () => {
        const { result } = renderEntry()

        expect(result.current.getMnemonicIndices()).toBeNull()

        await act(async () => {
            await result.current.handleWordChange(TWELVE_WORDS.join(' '), 0)
        })
        act(() => {
            result.current.updateWord('zzzz', 3)
        })

        expect(result.current.getMnemonicIndices()).toBeNull()
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

describe('useMnemonicWordEntry - normalization and validity', () => {
    it('lowercases a capitalized typed word', () => {
        const { result } = renderHook(() =>
            useMnemonicWordEntry({
                wordCount: 2,
                onTooManyWords: vi.fn(),
                onInsufficientSlots: vi.fn(),
            }),
        )

        act(() => result.current.updateWord('Abandon', 0))

        expect(result.current.words[0]).toBe('abandon')
    })

    it('lowercases every word of a capitalized paste', () => {
        const { result } = renderHook(() =>
            useMnemonicWordEntry({
                wordCount: 2,
                onTooManyWords: vi.fn(),
                onInsufficientSlots: vi.fn(),
            }),
        )

        act(() => result.current.updateWord('Abandon Ability', 0))

        expect(result.current.words).toEqual(['abandon', 'ability'])
    })

    it('marks a non-wordlist word invalid but leaves empty slots unmarked', () => {
        const { result } = renderHook(() =>
            useMnemonicWordEntry({
                wordCount: 2,
                onTooManyWords: vi.fn(),
                onInsufficientSlots: vi.fn(),
            }),
        )

        act(() => result.current.updateWord('zzzz', 0))

        expect(result.current.invalidWordIndices.has(0)).toBe(true)
        expect(result.current.invalidWordIndices.has(1)).toBe(false)
        expect(result.current.areAllWordsValid).toBe(false)
    })

    it('reports all words valid once every slot holds a wordlist word', () => {
        const { result } = renderHook(() =>
            useMnemonicWordEntry({
                wordCount: 2,
                onTooManyWords: vi.fn(),
                onInsufficientSlots: vi.fn(),
            }),
        )

        act(() => result.current.updateWord('Abandon Ability', 0))

        expect(result.current.areAllWordsValid).toBe(true)
        expect(result.current.invalidWordIndices.size).toBe(0)
    })
})

describe('useMnemonicWordEntry — handleSubmitEditing', () => {
    it('advances focus to the next slot when called for any non-last index', () => {
        const { result } = renderEntry()

        act(() => {
            result.current.handleSubmitEditing(5)
        })

        expect(result.current.focused).toBe(6)
    })

    it('does not advance past the last slot', () => {
        const { result } = renderEntry()

        act(() => {
            result.current.setFocused(11)
        })

        act(() => {
            result.current.handleSubmitEditing(11)
        })

        expect(result.current.focused).toBe(11)
    })
})
