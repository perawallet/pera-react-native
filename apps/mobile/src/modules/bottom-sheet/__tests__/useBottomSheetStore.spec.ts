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

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { act } from '@testing-library/react'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import type { InjectedSheetProps } from '../types'
import { useBottomSheetStore } from '../hooks/useBottomSheetStore'

const mockGenerateId = vi.mocked(generateOrderedUniqueId)
let idCounter = 0

type TestSheetProps = InjectedSheetProps & {
    title: string
}

const TestSheet = (_props: TestSheetProps) => null

describe('useBottomSheetStore', () => {
    beforeEach(() => {
        idCounter = 0
        mockGenerateId.mockImplementation(() => `test-id-${++idCounter}`)
        act(() => {
            useBottomSheetStore.getState().resetState()
        })
    })

    test('starts with an empty stack', () => {
        const state = useBottomSheetStore.getState()
        expect(state.stack).toEqual([])
    })

    test('pushSheet adds an entry and returns an id', () => {
        const id = useBottomSheetStore
            .getState()
            .pushSheet(TestSheet, { title: 'Hello' }, { size: 'lg' })

        expect(typeof id).toBe('string')
        expect(id.length).toBeGreaterThan(0)

        const { stack } = useBottomSheetStore.getState()
        expect(stack).toHaveLength(1)
        expect(stack[0].id).toBe(id)
        expect(stack[0].component).toBe(TestSheet)
        expect(stack[0].props).toEqual({ title: 'Hello' })
        expect(stack[0].options).toEqual({ size: 'lg' })
    })

    test('pushSheet stacks multiple entries in order', () => {
        useBottomSheetStore.getState().pushSheet(TestSheet, { title: 'First' })
        useBottomSheetStore.getState().pushSheet(TestSheet, { title: 'Second' })

        const { stack } = useBottomSheetStore.getState()
        expect(stack).toHaveLength(2)
        expect(stack[0].props).toEqual({ title: 'First' })
        expect(stack[1].props).toEqual({ title: 'Second' })
    })

    test('popSheet removes the last entry', () => {
        useBottomSheetStore.getState().pushSheet(TestSheet, { title: 'First' })
        useBottomSheetStore.getState().pushSheet(TestSheet, { title: 'Second' })

        useBottomSheetStore.getState().popSheet()

        const { stack } = useBottomSheetStore.getState()
        expect(stack).toHaveLength(1)
        expect(stack[0].props).toEqual({ title: 'First' })
    })

    test('popSheet on empty stack is a no-op', () => {
        useBottomSheetStore.getState().popSheet()
        expect(useBottomSheetStore.getState().stack).toEqual([])
    })

    test('removeSheet removes entry by id', () => {
        const id1 = useBottomSheetStore
            .getState()
            .pushSheet(TestSheet, { title: 'First' })
        const id2 = useBottomSheetStore
            .getState()
            .pushSheet(TestSheet, { title: 'Second' })

        useBottomSheetStore.getState().removeSheet(id1)

        const { stack } = useBottomSheetStore.getState()
        expect(stack).toHaveLength(1)
        expect(stack[0].id).toBe(id2)
    })

    test('removeSheet with unknown id is a no-op', () => {
        useBottomSheetStore.getState().pushSheet(TestSheet, { title: 'First' })

        useBottomSheetStore.getState().removeSheet('nonexistent')

        expect(useBottomSheetStore.getState().stack).toHaveLength(1)
    })

    test('clearSheets empties the stack', () => {
        useBottomSheetStore.getState().pushSheet(TestSheet, { title: 'First' })
        useBottomSheetStore.getState().pushSheet(TestSheet, { title: 'Second' })

        useBottomSheetStore.getState().clearSheets()

        expect(useBottomSheetStore.getState().stack).toEqual([])
    })

    test('resetState restores initial state', () => {
        useBottomSheetStore.getState().pushSheet(TestSheet, { title: 'First' })

        act(() => {
            useBottomSheetStore.getState().resetState()
        })

        expect(useBottomSheetStore.getState().stack).toEqual([])
    })

    test('pushSheet defaults options to empty object', () => {
        useBottomSheetStore
            .getState()
            .pushSheet(TestSheet, { title: 'No options' })

        const { stack } = useBottomSheetStore.getState()
        expect(stack[0].options).toEqual({})
    })
})
