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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Keyboard } from 'react-native'

import { MNEMONIC_WORDLIST } from '@perawallet/wallet-core-kms'

import { useClipboard } from '@hooks/useClipboard'

import { normalizeMnemonicWord, splitMnemonic } from '../utils'

import type { Nullable } from '@perawallet/wallet-core-shared'
import type { PWInputRef } from '@components/core'

const MAX_SUGGESTIONS = 4
const WORD_TO_INDEX: Map<string, number> = new Map(
    MNEMONIC_WORDLIST.map((word, index) => [word, index]),
)

/**
 * Retained slot state. A completed wordlist word is held as its index — the
 * only string it ever renders through is the interned wordlist constant, so
 * the ordered phrase is never retained as user-typed strings. `draft` exists
 * only for what indices can't represent: empty, partial, or non-wordlist
 * input (TextInputs are strings; that boundary is irreducible).
 */
type MnemonicSlot =
    | { kind: 'index'; index: number }
    | { kind: 'draft'; draft: string }

const emptySlot = (): MnemonicSlot => ({ kind: 'draft', draft: '' })

const toSlot = (token: string): MnemonicSlot => {
    const index = WORD_TO_INDEX.get(token)
    return index === undefined
        ? { kind: 'draft', draft: token }
        : { kind: 'index', index }
}

const slotText = (slot: MnemonicSlot): string =>
    slot.kind === 'index' ? MNEMONIC_WORDLIST[slot.index] : slot.draft

export type UseMnemonicWordEntryParams = {
    wordCount: number
    /** Fired when a paste holds more words than `wordCount`. */
    onTooManyWords: () => void
    /** Fired when a partial paste can't fit in the slots after the paste site. */
    onInsufficientSlots: () => void
}

export type UseMnemonicWordEntryResult = {
    /** Render-time projection of the slots. Valid words resolve to interned
     * wordlist constants; this array is derived per render, never the
     * retained representation. */
    words: string[]
    focused: number
    suggestions: string[]
    setFocused: (index: number) => void
    /** Programmatic setter (QR scan, deep link); distributes like a paste. */
    updateWord: (value: string, index: number) => void
    handleWordChange: (value: string, index: number) => Promise<void>
    handleSelectSuggestion: (word: string) => void
    refCallbacks: ((ref: Nullable<PWInputRef>) => void)[]
    handleSubmitEditing: (index: number) => void
    /** Slots holding a non-empty word that is not in the wordlist. Empty
     * slots are absent — they are incomplete, not wrong. */
    invalidWordIndices: Set<number>
    areAllWordsValid: boolean
    /** Fresh zeroable buffer built straight from the slot indices — no
     * string pass. Null while any slot is not a wordlist word. Caller owns
     * zeroing the returned buffer. */
    getMnemonicIndices: () => Uint16Array | null
}

/**
 * Drives "enter a mnemonic across N input slots" screens: per-slot state,
 * paste distribution, and wordlist suggestions. Copy-agnostic — callers pass
 * their own `onTooManyWords` / `onInsufficientSlots` handlers.
 */
export const useMnemonicWordEntry = ({
    wordCount,
    onTooManyWords,
    onInsufficientSlots,
}: UseMnemonicWordEntryParams): UseMnemonicWordEntryResult => {
    const { readText } = useClipboard()

    const [slots, setSlots] = useState<MnemonicSlot[]>(() =>
        Array.from({ length: wordCount }, emptySlot),
    )
    const slotsRef = useRef(slots)
    slotsRef.current = slots

    const [focused, setFocused] = useState(0)

    const words = useMemo(() => slots.map(slotText), [slots])

    const suggestions = useMemo(() => {
        const slot = slots[focused]
        const current = slot ? slotText(slot).trim().toLowerCase() : ''
        if (current.length < 2) return []
        return MNEMONIC_WORDLIST.filter(
            w => w !== current && w.startsWith(current),
        ).slice(0, MAX_SUGGESTIONS)
    }, [slots, focused])

    const invalidWordIndices = useMemo(() => {
        const invalid = new Set<number>()
        slots.forEach((slot, index) => {
            if (slot.kind === 'draft' && slot.draft.length > 0)
                invalid.add(index)
        })
        return invalid
    }, [slots])

    const areAllWordsValid = useMemo(
        () => slots.every(slot => slot.kind === 'index'),
        [slots],
    )

    const getMnemonicIndices = useCallback((): Uint16Array | null => {
        const current = slotsRef.current
        const indices = new Uint16Array(current.length)
        for (let i = 0; i < current.length; i++) {
            const slot = current[i]
            if (slot.kind !== 'index') return null
            indices[i] = slot.index
        }
        return indices
    }, [])

    const updateWord = useCallback(
        (value: string, index: number) => {
            const split = splitMnemonic(value).map(normalizeMnemonicWord)

            if (split.length > 1) {
                if (split.length === wordCount) {
                    setSlots(split.map(toSlot))
                    // Drop keyboard so the submit button is reachable.
                    Keyboard.dismiss()
                    return
                }

                if (split.length > wordCount) {
                    onTooManyWords()
                    return
                }

                const remainingSlots = wordCount - index
                if (split.length <= remainingSlots) {
                    setSlots(prev => {
                        const next = [...prev]
                        split.forEach((w, i) => {
                            next[index + i] = toSlot(w)
                        })
                        return next
                    })
                } else {
                    onInsufficientSlots()
                }
                return
            }

            // Use the split token, not value.trim(), so separators
            // splitMnemonic strips (commas, mixed whitespace) don't linger in
            // the slot and block the user.
            setSlots(prev => {
                const next = [...prev]
                next[index] = toSlot(split[0] ?? '')
                return next
            })
        },
        [wordCount, onTooManyWords, onInsufficientSlots],
    )

    const handleWordChange = useCallback(
        async (value: string, index: number) => {
            const currentSlot = slotsRef.current[index]
            const currentWord = currentSlot ? slotText(currentSlot) : ''
            const delta = value.length - currentWord.length

            // Android keyboards (Gboard, Samsung) mangle multi-word pastes by
            // collapsing whitespace, so on a paste-sized delta we re-read the
            // clipboard. Skip it when the change looks like autocomplete (a
            // single valid wordlist token) — iOS delivers completed words in
            // one event and would otherwise overwrite every slot from whatever
            // mnemonic sits on the clipboard. Use splitMnemonic, not
            // value.trim(), so trailing punctuation still reads as one token.
            const tokens = splitMnemonic(value)
            const looksLikeAutocomplete =
                tokens.length === 1 &&
                WORD_TO_INDEX.has(tokens[0].toLowerCase())

            if (delta > 1 && !looksLikeAutocomplete) {
                try {
                    const clipboardContent = await readText()
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
        [updateWord, readText],
    )

    const handleSelectSuggestion = useCallback(
        (word: string) => {
            setSlots(prev => {
                const next = [...prev]
                next[focused] = toSlot(word)
                return next
            })
            if (focused < wordCount - 1) {
                setFocused(focused + 1)
            }
        },
        [focused, wordCount],
    )

    const inputRefs = useRef<Nullable<PWInputRef>[]>(
        new Array(wordCount).fill(null),
    )

    const refCallbacks = useMemo(
        () =>
            Array.from(
                { length: wordCount },
                (_, i) => (ref: Nullable<PWInputRef>) => {
                    inputRefs.current[i] = ref
                },
            ),
        [wordCount],
    )

    // Skip the mount run so we don't fight the consumer's `autoFocus`.
    const isInitialFocusRunRef = useRef(true)
    useEffect(() => {
        if (isInitialFocusRunRef.current) {
            isInitialFocusRunRef.current = false
            return
        }
        inputRefs.current[focused]?.focus()
    }, [focused])

    // Scrub the retained slots on unmount. Index slots are mutable numbers and
    // zero in place; draft strings are immutable JS strings, so dropping the
    // reference is the best the platform allows.
    useEffect(
        () => () => {
            slotsRef.current.forEach(slot => {
                if (slot.kind === 'index') slot.index = 0
                else slot.draft = ''
            })
        },
        [],
    )

    const handleSubmitEditing = useCallback(
        (index: number) => {
            if (index < wordCount - 1) {
                setFocused(index + 1)
            }
        },
        [wordCount],
    )

    return {
        words,
        focused,
        suggestions,
        setFocused,
        updateWord,
        handleWordChange,
        handleSelectSuggestion,
        refCallbacks,
        handleSubmitEditing,
        invalidWordIndices,
        areAllWordsValid,
        getMnemonicIndices,
    }
}
