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

import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { InboxRequestRow } from '../inboxRequestRow'
import { useInboxRowSelection } from '../useInboxRowSelection'

const backHandler = vi.hoisted(() => ({
    listener: null as null | (() => boolean),
    remove: vi.fn(),
}))

vi.mock('react-native', () => ({
    BackHandler: {
        addEventListener: (_: string, listener: () => boolean) => {
            backHandler.listener = listener
            return { remove: backHandler.remove }
        },
    },
}))

const header = { kind: 'header', key: 'header|a', chainId: 'algorand' }
const rowA = { kind: 'token', key: 'a' }
const rowB = { kind: 'token', key: 'b' }
const ROWS = [header, rowA, rowB] as unknown as InboxRequestRow[]

const render = (rows = ROWS) =>
    renderHook(({ current }) => useInboxRowSelection(current), {
        initialProps: { current: rows },
    })

describe('useInboxRowSelection', () => {
    beforeEach(() => {
        backHandler.listener = null
        backHandler.remove.mockClear()
    })

    it('starts with no selection and starts selecting on the first toggle', () => {
        const { result } = render()
        expect(result.current.selectedKeys).toBeNull()

        act(() => result.current.toggleRow(ROWS[1]!))

        expect([...result.current.selectedKeys!]).toEqual(['a'])
    })

    it('ignores section headers', () => {
        const { result } = render()

        act(() => result.current.toggleRow(ROWS[0]!))

        expect(result.current.selectedKeys).toBeNull()
    })

    it('stays selecting with nothing ticked when the last row is unticked', () => {
        const { result } = render()

        act(() => result.current.toggleRow(ROWS[1]!))
        act(() => result.current.toggleRow(ROWS[1]!))

        expect(result.current.selectedKeys?.size).toBe(0)
    })

    it('selects every row, then clears them, through toggleAll', () => {
        const { result } = render()
        act(() => result.current.toggleRow(ROWS[1]!))

        act(() => result.current.toggleAll())
        expect(result.current.isAllSelected).toBe(true)
        expect([...result.current.selectedKeys!]).toEqual(['a', 'b'])

        act(() => result.current.toggleAll())
        expect(result.current.selectedKeys?.size).toBe(0)
    })

    it('drops selected rows that a refetch removes', () => {
        const { result, rerender } = render()
        act(() => result.current.toggleAll())

        rerender({ current: [header, rowA] as unknown as InboxRequestRow[] })

        expect([...result.current.selectedKeys!]).toEqual(['a'])
        expect(result.current.isAllSelected).toBe(true)
    })

    it('leaves selection mode on clear', () => {
        const { result } = render()
        act(() => result.current.toggleRow(ROWS[1]!))

        act(() => result.current.clear())

        expect(result.current.selectedKeys).toBeNull()
    })

    it('starts selecting on a long-press but ignores further long-presses', () => {
        const { result } = render()

        act(() => result.current.startWith(ROWS[1]!))
        act(() => result.current.startWith(ROWS[1]!))
        act(() => result.current.startWith(ROWS[2]!))

        expect([...result.current.selectedKeys!]).toEqual(['a'])
    })

    it("leaves selection on Android's back button and stops listening", () => {
        const { result } = render()
        act(() => result.current.toggleRow(ROWS[1]!))

        let isHandled = false
        act(() => {
            isHandled = backHandler.listener!()
        })

        expect(isHandled).toBe(true)
        expect(result.current.selectedKeys).toBeNull()
        expect(backHandler.remove).toHaveBeenCalled()
    })
})
