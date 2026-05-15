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

import { useCallback, useMemo, useRef, useState } from 'react'
import * as Clipboard from 'expo-clipboard'

import { MNEMONIC_WORDLIST } from '@perawallet/wallet-core-kms'

import { splitMnemonic } from '../utils'

const MAX_SUGGESTIONS = 4
const WORDLIST_SET = new Set(MNEMONIC_WORDLIST)

export type UseMnemonicWordEntryParams = {
    /** Total number of words the user is expected to enter. */
    wordCount: number
    /** Fired when a paste contains more words than `wordCount`. Callers wire
     * their own toast / dialog copy from this. */
    onTooManyWords: () => void
    /** Fired when a partial paste cannot fit in the slots remaining at the
     * paste site (e.g. pasting 6 words starting at slot 9 of a 12-word
     * mnemonic). */
    onInsufficientSlots: () => void
}

export type UseMnemonicWordEntryResult = {
    words: string[]
    focused: number
    suggestions: string[]
    setFocused: (index: number) => void
    /** Direct setter for programmatic input (QR scan, deep link). Splits and
     * distributes the same way a paste does. */
    updateWord: (value: string, index: number) => void
    /** Wired straight to `<TextInput onChangeText>`. Detects pastes via the
     * input-length delta and consults the system clipboard so multi-word
     * pastes still distribute when the keyboard collapses whitespace. */
    handleWordChange: (value: string, index: number) => Promise<void>
    /** Sets the focused slot to the picked suggestion and advances focus. */
    handleSelectSuggestion: (word: string) => void
}

/**
 * Reusable mechanic for "enter a mnemonic across N input slots" screens.
 *
 * Handles:
 * - Per-slot word state with focus tracking.
 * - Paste distribution: a full N-word paste fills every slot regardless of
 *   which slot received it; a partial paste fills forward from the paste
 *   site.
 * - Clipboard fallback: some Android keyboards (Gboard, Samsung) corrupt
 *   multi-word pastes by collapsing whitespace into a single token. When
 *   the input-length delta suggests a paste, we re-read the clipboard and
 *   prefer it if it has more separable words than the value we received.
 * - Wordlist-driven suggestions for the focused slot, with the exact match
 *   filtered out so the suggestion row hides once the slot holds a complete
 *   word.
 *
 * The hook is wordlist- and copy-agnostic above the BIP39/Algo25 wordlist:
 * callers pass their own `onTooManyWords` / `onInsufficientSlots` handlers
 * so screen-specific i18n stays out of this layer.
 */
export const useMnemonicWordEntry = ({
    wordCount,
    onTooManyWords,
    onInsufficientSlots,
}: UseMnemonicWordEntryParams): UseMnemonicWordEntryResult => {
    const [words, setWords] = useState<string[]>(() =>
        new Array(wordCount).fill(''),
    )
    const wordsRef = useRef(words)
    wordsRef.current = words

    const [focused, setFocused] = useState(0)

    const suggestions = useMemo(() => {
        const current = (words[focused] ?? '').trim().toLowerCase()
        if (current.length < 2) return []
        return MNEMONIC_WORDLIST.filter(
            w => w !== current && w.startsWith(current),
        ).slice(0, MAX_SUGGESTIONS)
    }, [words, focused])

    const updateWord = useCallback(
        (value: string, index: number) => {
            const split = splitMnemonic(value)

            if (split.length > 1) {
                if (split.length === wordCount) {
                    setWords(split)
                    return
                }

                if (split.length > wordCount) {
                    onTooManyWords()
                    return
                }

                const remainingSlots = wordCount - index
                if (split.length <= remainingSlots) {
                    setWords(prev => {
                        const next = [...prev]
                        split.forEach((w, i) => {
                            next[index + i] = w
                        })
                        return next
                    })
                } else {
                    onInsufficientSlots()
                }
                return
            }

            setWords(prev => {
                const next = [...prev]
                next[index] = value.trim()
                return next
            })
        },
        [wordCount, onTooManyWords, onInsufficientSlots],
    )

    const handleWordChange = useCallback(
        async (value: string, index: number) => {
            const currentWord = wordsRef.current[index] ?? ''
            const delta = value.length - currentWord.length

            // The clipboard fallback exists for keyboards (Gboard, Samsung)
            // that mangle multi-word pastes — collapsing whitespace,
            // dropping the first separator, etc. We want to consult the
            // clipboard for those cases but NOT for ordinary typing or
            // autocomplete.
            //
            // Heuristic: skip the clipboard read whenever the change looks
            // like autocomplete — a single token that is itself a valid
            // BIP39 word. iOS autocomplete delivers the whole completed
            // word in one change event, which would otherwise trip the
            // delta>1 check and, if the user had a mnemonic on the
            // clipboard for any reason, overwrite every slot.
            //
            // Everything else with delta>1 (multi-token paste, single
            // non-wordlist token like a collapsed `helpinhale`, etc.) goes
            // through the clipboard check, which only takes effect when
            // the clipboard has more separable words than the received
            // value.
            const trimmedValue = value.trim().toLowerCase()
            const looksLikeAutocomplete =
                splitMnemonic(value).length === 1 &&
                WORDLIST_SET.has(trimmedValue)

            if (delta > 1 && !looksLikeAutocomplete) {
                try {
                    const clipboardContent = await Clipboard.getStringAsync()
                    if (
                        clipboardContent &&
                        splitMnemonic(clipboardContent).length >
                            splitMnemonic(value).length
                    ) {
                        updateWord(clipboardContent, index)
                        return
                    }
                } catch {
                    // Clipboard read failed; fall through to the typed value.
                }
            }

            updateWord(value, index)
        },
        [updateWord],
    )

    const handleSelectSuggestion = useCallback(
        (word: string) => {
            setWords(prev => {
                const next = [...prev]
                next[focused] = word
                return next
            })
            if (focused < wordCount - 1) {
                setFocused(focused + 1)
            }
        },
        [focused, wordCount],
    )

    return {
        words,
        focused,
        suggestions,
        setFocused,
        updateWord,
        handleWordChange,
        handleSelectSuggestion,
    }
}
