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

import { describe, test, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBackupVerification } from '../useBackupVerification'

const words = ['alpha', 'bravo', 'charlie']

describe('useBackupVerification', () => {
    test('starts with empty slots and all words in pool', () => {
        const { result } = renderHook(() =>
            useBackupVerification(words, () => {}),
        )
        expect(result.current.orderedSlots).toEqual([null, null, null])
        expect([...result.current.poolWords].sort()).toEqual([...words].sort())
        expect(result.current.isFilled).toBe(false)
    })

    test('onTapPoolWord moves word into first empty slot', () => {
        const { result } = renderHook(() =>
            useBackupVerification(words, () => {}),
        )
        act(() =>
            result.current.onTapPoolWord(
                'bravo',
                result.current.poolWords.indexOf('bravo'),
            ),
        )
        expect(result.current.orderedSlots[0]).toBe('bravo')
        expect(result.current.poolWords).not.toContain('bravo')
    })

    test('onTapSlot returns the slot word back to the pool', () => {
        const { result } = renderHook(() =>
            useBackupVerification(words, () => {}),
        )
        act(() =>
            result.current.onTapPoolWord(
                'bravo',
                result.current.poolWords.indexOf('bravo'),
            ),
        )
        act(() => result.current.onTapSlot(0))
        expect(result.current.orderedSlots[0]).toBeNull()
        expect(result.current.poolWords).toContain('bravo')
    })

    test('isFilled becomes true when all slots have words', () => {
        const { result } = renderHook(() =>
            useBackupVerification(words, () => {}),
        )
        act(() => {
            const a = result.current.poolWords.indexOf('alpha')
            result.current.onTapPoolWord('alpha', a)
        })
        act(() => {
            const b = result.current.poolWords.indexOf('bravo')
            result.current.onTapPoolWord('bravo', b)
        })
        act(() => {
            const c = result.current.poolWords.indexOf('charlie')
            result.current.onTapPoolWord('charlie', c)
        })
        expect(result.current.isFilled).toBe(true)
    })

    test('onFinish calls onSuccess when order matches', () => {
        let called = 0
        const { result } = renderHook(() =>
            useBackupVerification(words, () => {
                called += 1
            }),
        )
        act(() => {
            const a = result.current.poolWords.indexOf('alpha')
            result.current.onTapPoolWord('alpha', a)
        })
        act(() => {
            const b = result.current.poolWords.indexOf('bravo')
            result.current.onTapPoolWord('bravo', b)
        })
        act(() => {
            const c = result.current.poolWords.indexOf('charlie')
            result.current.onTapPoolWord('charlie', c)
        })
        act(() => result.current.onFinish())
        expect(called).toBe(1)
        expect(result.current.validationError).toBe(false)
    })

    test('onFinish sets validationError when order is wrong', () => {
        let called = 0
        const { result } = renderHook(() =>
            useBackupVerification(words, () => {
                called += 1
            }),
        )
        act(() => {
            const c = result.current.poolWords.indexOf('charlie')
            result.current.onTapPoolWord('charlie', c)
        })
        act(() => {
            const b = result.current.poolWords.indexOf('bravo')
            result.current.onTapPoolWord('bravo', b)
        })
        act(() => {
            const a = result.current.poolWords.indexOf('alpha')
            result.current.onTapPoolWord('alpha', a)
        })
        act(() => result.current.onFinish())
        expect(called).toBe(0)
        expect(result.current.validationError).toBe(true)
    })

    test('onStartOver clears slots and refills the pool', () => {
        const { result } = renderHook(() =>
            useBackupVerification(words, () => {}),
        )
        act(() => {
            const c = result.current.poolWords.indexOf('charlie')
            result.current.onTapPoolWord('charlie', c)
        })
        act(() => result.current.onStartOver())
        expect(result.current.orderedSlots).toEqual([null, null, null])
        expect([...result.current.poolWords].sort()).toEqual([...words].sort())
        expect(result.current.validationError).toBe(false)
    })

    test('validationError clears on the next interaction', () => {
        const { result } = renderHook(() =>
            useBackupVerification(words, () => {}),
        )
        act(() => {
            const c = result.current.poolWords.indexOf('charlie')
            result.current.onTapPoolWord('charlie', c)
        })
        act(() => {
            const b = result.current.poolWords.indexOf('bravo')
            result.current.onTapPoolWord('bravo', b)
        })
        act(() => {
            const a = result.current.poolWords.indexOf('alpha')
            result.current.onTapPoolWord('alpha', a)
        })
        act(() => result.current.onFinish())
        expect(result.current.validationError).toBe(true)
        act(() => result.current.onTapSlot(0))
        expect(result.current.validationError).toBe(false)
    })
})
