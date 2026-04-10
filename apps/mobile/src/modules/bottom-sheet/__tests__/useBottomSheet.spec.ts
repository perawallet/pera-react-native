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
import { renderHook, act } from '@testing-library/react'
import { generateOrderedUniqueId } from '@perawallet/wallet-core-shared'
import type { InjectedSheetProps } from '../types'
import { useBottomSheet } from '../hooks/useBottomSheet'
import { useBottomSheetStore } from '../hooks/useBottomSheetStore'

const mockGenerateId = vi.mocked(generateOrderedUniqueId)
let idCounter = 0

type TestSheetProps = InjectedSheetProps & {
    title: string
}

const TestSheet = (_props: TestSheetProps) => null

describe('useBottomSheet', () => {
    beforeEach(() => {
        idCounter = 0
        mockGenerateId.mockImplementation(() => `test-id-${++idCounter}`)
        act(() => {
            useBottomSheetStore.getState().resetState()
        })
    })

    test('openSheet pushes a sheet onto the stack', () => {
        const { result } = renderHook(() => useBottomSheet())

        act(() => {
            result.current.openSheet(TestSheet, { title: 'Test' })
        })

        expect(useBottomSheetStore.getState().stack).toHaveLength(1)
    })

    test('openSheet returns a sheet id', () => {
        const { result } = renderHook(() => useBottomSheet())

        let id: string = ''
        act(() => {
            id = result.current.openSheet(TestSheet, { title: 'Test' })
        })

        expect(typeof id).toBe('string')
        expect(id.length).toBeGreaterThan(0)
    })

    test('closeSheet removes a sheet by id', () => {
        const { result } = renderHook(() => useBottomSheet())

        let id: string = ''
        act(() => {
            id = result.current.openSheet(TestSheet, { title: 'Test' })
        })

        act(() => {
            result.current.closeSheet(id)
        })

        expect(useBottomSheetStore.getState().stack).toHaveLength(0)
    })

    test('closeTopSheet removes the topmost sheet', () => {
        const { result } = renderHook(() => useBottomSheet())

        act(() => {
            result.current.openSheet(TestSheet, { title: 'First' })
            result.current.openSheet(TestSheet, { title: 'Second' })
        })

        act(() => {
            result.current.closeTopSheet()
        })

        const { stack } = useBottomSheetStore.getState()
        expect(stack).toHaveLength(1)
        expect(stack[0].props).toEqual({ title: 'First' })
    })

    test('closeAllSheets empties the stack', () => {
        const { result } = renderHook(() => useBottomSheet())

        act(() => {
            result.current.openSheet(TestSheet, { title: 'First' })
            result.current.openSheet(TestSheet, { title: 'Second' })
        })

        act(() => {
            result.current.closeAllSheets()
        })

        expect(useBottomSheetStore.getState().stack).toHaveLength(0)
    })

    test('openSheet passes options through to the store', () => {
        const { result } = renderHook(() => useBottomSheet())

        act(() => {
            result.current.openSheet(
                TestSheet,
                { title: 'Test' },
                { size: 'lg', enablePanDownToClose: true },
            )
        })

        const { stack } = useBottomSheetStore.getState()
        expect(stack[0].options).toEqual({
            size: 'lg',
            enablePanDownToClose: true,
        })
    })
})
