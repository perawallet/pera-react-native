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

import { describe, test, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useBackupQuiz } from '../useBackupQuiz'

const WORDS = [
    'alpha',
    'bravo',
    'charlie',
    'delta',
    'echo',
    'foxtrot',
    'golf',
    'hotel',
    'india',
    'juliet',
    'kilo',
    'lima',
]

describe('useBackupQuiz', () => {
    test('generates 3 distinct questions with 3 options each', () => {
        const { result } = renderHook(() =>
            useBackupQuiz(WORDS, vi.fn(), vi.fn()),
        )
        expect(result.current.items).toHaveLength(3)
        const positions = result.current.items.map(i => i.position)
        expect(new Set(positions).size).toBe(3)
        result.current.items.forEach(item => {
            expect(item.options).toHaveLength(3)
            expect(item.options).toContain(item.correctWord)
            expect(item.selectedWord).toBeNull()
        })
    })

    test('isFilled flips to true once every item has a selection', () => {
        const { result } = renderHook(() =>
            useBackupQuiz(WORDS, vi.fn(), vi.fn()),
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
            useBackupQuiz(WORDS, onSuccess, onWrong),
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
            useBackupQuiz(WORDS, onSuccess, onWrong),
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
        // Regeneration: every item's selectedWord should be reset to null.
        result.current.items.forEach(item => {
            expect(item.selectedWord).toBeNull()
        })
        // Items are re-shuffled; identity check is sufficient.
        expect(result.current.items).not.toBe(originalItems)
    })

    test('returns empty items when mnemonic is shorter than question count', () => {
        const { result } = renderHook(() =>
            useBackupQuiz(['only', 'two'], vi.fn(), vi.fn()),
        )
        expect(result.current.items).toHaveLength(0)
        expect(result.current.isFilled).toBe(false)
    })
})
