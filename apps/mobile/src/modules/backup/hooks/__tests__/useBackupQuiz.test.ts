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

import { describe, test, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { MnemonicWordAtPosition } from '@perawallet/wallet-core-kms'
import { useBackupQuiz } from '../useBackupQuiz'

const CORRECT_PAIRS: MnemonicWordAtPosition[] = [
    { index: 3, word: 'alpha' },
    { index: 7, word: 'bravo' },
    { index: 11, word: 'charlie' },
]

const DISTRACTOR_POOL = [
    'delta',
    'echo',
    'foxtrot',
    'golf',
    'hotel',
    'india',
    'juliet',
    'kilo',
    'lima',
    'mike',
    'november',
]

describe('useBackupQuiz', () => {
    test('generates one question per correct pair with 3 options each', () => {
        const { result } = renderHook(() =>
            useBackupQuiz(CORRECT_PAIRS, DISTRACTOR_POOL, vi.fn(), vi.fn()),
        )
        expect(result.current.items).toHaveLength(CORRECT_PAIRS.length)
        const positions = result.current.items.map(i => i.position)
        expect(positions).toEqual(CORRECT_PAIRS.map(p => p.index))
        result.current.items.forEach((item, i) => {
            expect(item.options).toHaveLength(3)
            expect(item.options).toContain(item.correctWord)
            expect(item.correctWord).toBe(CORRECT_PAIRS[i].word)
            expect(item.selectedWord).toBeNull()
        })
    })

    test('isFilled flips to true once every item has a selection', () => {
        const { result } = renderHook(() =>
            useBackupQuiz(CORRECT_PAIRS, DISTRACTOR_POOL, vi.fn(), vi.fn()),
        )
        expect(result.current.isFilled).toBe(false)

        act(() => {
            result.current.items.forEach((item, i) =>
                result.current.onSelect(i, item.options[0]),
            )
        })
        expect(result.current.isFilled).toBe(true)
    })

    test('calls onSuccess when all selections match the correct word', () => {
        const onSuccess = vi.fn()
        const onWrong = vi.fn()
        const { result } = renderHook(() =>
            useBackupQuiz(CORRECT_PAIRS, DISTRACTOR_POOL, onSuccess, onWrong),
        )
        act(() => {
            result.current.items.forEach((item, i) =>
                result.current.onSelect(i, item.correctWord),
            )
        })
        act(() => result.current.onSubmit())

        expect(onSuccess).toHaveBeenCalledOnce()
        expect(onWrong).not.toHaveBeenCalled()
    })

    test('calls onWrong and regenerates questions on incorrect submission', () => {
        const onSuccess = vi.fn()
        const onWrong = vi.fn()
        const { result } = renderHook(() =>
            useBackupQuiz(CORRECT_PAIRS, DISTRACTOR_POOL, onSuccess, onWrong),
        )
        const originalItems = result.current.items
        act(() => {
            result.current.items.forEach((item, i) => {
                const wrongChoice =
                    item.options.find(opt => opt !== item.correctWord) ??
                    item.options[0]
                result.current.onSelect(i, wrongChoice)
            })
        })
        act(() => result.current.onSubmit())

        expect(onSuccess).not.toHaveBeenCalled()
        expect(onWrong).toHaveBeenCalledOnce()
        expect(result.current.hasError).toBe(true)
        result.current.items.forEach(item => {
            expect(item.selectedWord).toBeNull()
        })
        expect(result.current.items).not.toBe(originalItems)
    })

    test('returns empty items when no correct pairs are provided', () => {
        const { result } = renderHook(() =>
            useBackupQuiz([], DISTRACTOR_POOL, vi.fn(), vi.fn()),
        )
        expect(result.current.items).toHaveLength(0)
        expect(result.current.isFilled).toBe(false)
    })

    test('rebuilds items when correctPairs arrives after initial render', () => {
        const { result, rerender } = renderHook(
            ({ pairs }: { pairs: MnemonicWordAtPosition[] }) =>
                useBackupQuiz(pairs, DISTRACTOR_POOL, vi.fn(), vi.fn()),
            { initialProps: { pairs: [] as MnemonicWordAtPosition[] } },
        )

        expect(result.current.items).toHaveLength(0)

        rerender({ pairs: CORRECT_PAIRS })

        expect(result.current.items).toHaveLength(CORRECT_PAIRS.length)
        const positions = result.current.items.map(i => i.position)
        expect(positions).toEqual(CORRECT_PAIRS.map(p => p.index))
    })
})
