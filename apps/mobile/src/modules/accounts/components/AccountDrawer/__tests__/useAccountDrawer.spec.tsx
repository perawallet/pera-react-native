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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { BackHandler } from 'react-native'

import { useAccountDrawer } from '../useAccountDrawer'

const mocks = vi.hoisted(() => ({
    goToAddAccount: vi.fn(),
    goToSearch: vi.fn(),
    goToPeraCardActivation: vi.fn(),
    openPeraCard: vi.fn(),
    openSort: vi.fn(() => Promise.resolve()),
}))

vi.mock('@modules/accounts/hooks/useAccountSwitcherActions', () => ({
    useAccountSwitcherActions: () => mocks,
}))

describe('useAccountDrawer', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('opens and closes', () => {
        const { result } = renderHook(() => useAccountDrawer())
        expect(result.current.isOpen).toBe(false)

        act(() => result.current.openDrawer())
        expect(result.current.isOpen).toBe(true)

        act(() => result.current.closeDrawer())
        expect(result.current.isOpen).toBe(false)
    })

    it('closes when an account is picked', () => {
        const { result } = renderHook(() => useAccountDrawer())
        act(() => result.current.openDrawer())

        act(() => result.current.handleSelected())

        expect(result.current.isOpen).toBe(false)
    })

    it.each([
        ['handleAddAccount', 'goToAddAccount'],
        ['handleSearch', 'goToSearch'],
        ['handlePeraCardActivate', 'goToPeraCardActivation'],
        ['handlePeraCardOpen', 'openPeraCard'],
    ] as const)(
        '%s navigates without waiting on the drawer animation',
        (handler, expectedAction) => {
            const { result } = renderHook(() => useAccountDrawer())
            act(() => result.current.openDrawer())

            act(() => result.current[handler]())

            expect(result.current.isOpen).toBe(false)
            expect(mocks[expectedAction]).toHaveBeenCalledTimes(1)
        },
    )

    it('keeps the drawer open while sorting, since the sheet layers over it', () => {
        const { result } = renderHook(() => useAccountDrawer())
        act(() => result.current.openDrawer())

        act(() => result.current.handleOpenSort())

        expect(result.current.isOpen).toBe(true)
        expect(mocks.openSort).toHaveBeenCalledTimes(1)
    })

    it('claims the hardware back press to close instead of popping the tab', () => {
        const addEventListener = vi.spyOn(BackHandler, 'addEventListener')
        const { result } = renderHook(() => useAccountDrawer())

        act(() => result.current.openDrawer())

        // RN types the listener as taking an event arg it never passes for
        // 'hardwareBackPress'; the hook's handler ignores it either way.
        const handler = addEventListener.mock.calls.at(-1)?.[1] as unknown as
            | (() => boolean | null | undefined)
            | undefined
        expect(handler).toBeDefined()

        let handled: boolean | null | undefined
        act(() => {
            handled = handler?.()
        })

        expect(handled).toBe(true)
        expect(result.current.isOpen).toBe(false)
    })

    it('releases the back press handler once closed', () => {
        const remove = vi.fn()
        vi.spyOn(BackHandler, 'addEventListener').mockReturnValue({
            remove,
        } as unknown as ReturnType<typeof BackHandler.addEventListener>)
        const { result } = renderHook(() => useAccountDrawer())

        act(() => result.current.openDrawer())
        act(() => result.current.closeDrawer())

        expect(remove).toHaveBeenCalled()
    })
})
