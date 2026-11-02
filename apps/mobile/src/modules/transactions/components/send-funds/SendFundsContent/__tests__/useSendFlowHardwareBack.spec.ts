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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { BackHandler } from 'react-native'
import { isAndroid } from '@utils/platform'
import { useBottomSheetStore } from '@modules/bottom-sheet'
import { useSendFlowHardwareBack } from '../useSendFlowHardwareBack'

const { mockRequestClose, mockUseContext } = vi.hoisted(() => ({
    mockRequestClose: vi.fn(),
    mockUseContext: vi.fn(),
}))

vi.mock('react', async importOriginal => ({
    ...(await importOriginal<typeof import('react')>()),
    useContext: mockUseContext,
}))

vi.mock('@utils/platform', () => ({ isAndroid: vi.fn() }))

vi.mock('@modules/transactions/hooks/send-funds/useSendFlowClose', () => ({
    useSendFlowClose: () => ({ requestClose: mockRequestClose }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    BottomSheetIdContext: {},
    useBottomSheetStore: { getState: vi.fn() },
}))

const SEND_SHEET = 'send-funds'

const makeRef = (overrides: { canGoBack?: boolean; isReady?: boolean } = {}) =>
    ({
        isReady: vi.fn(() => overrides.isReady ?? true),
        canGoBack: vi.fn(() => overrides.canGoBack ?? false),
        goBack: vi.fn(),
    }) as never

const openSheets = (...ids: string[]) =>
    vi.mocked(useBottomSheetStore.getState).mockReturnValue({
        requests: ids.map(id => ({ id, isVisible: true })),
    } as never)

const pressBack = () => {
    const handler = vi.mocked(BackHandler.addEventListener).mock
        .calls[0][1] as () => boolean
    return handler()
}

describe('useSendFlowHardwareBack', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(isAndroid).mockReturnValue(true)
        mockUseContext.mockReturnValue(SEND_SHEET)
        vi.mocked(BackHandler.addEventListener).mockReturnValue({
            remove: vi.fn(),
        } as never)
        openSheets(SEND_SHEET)
    })

    it('goes back a screen when there is one to return to', () => {
        const ref = makeRef({ canGoBack: true })
        renderHook(() => useSendFlowHardwareBack(ref))

        expect(pressBack()).toBe(true)

        expect((ref as { goBack: () => void }).goBack).toHaveBeenCalled()
        expect(mockRequestClose).not.toHaveBeenCalled()
    })

    it('closes the flow from the first screen', () => {
        renderHook(() => useSendFlowHardwareBack(makeRef()))

        expect(pressBack()).toBe(true)

        expect(mockRequestClose).toHaveBeenCalledTimes(1)
    })

    it('swallows back while a sheet is open over the flow', () => {
        openSheets(SEND_SHEET, 'add-note')
        const ref = makeRef({ canGoBack: true })
        renderHook(() => useSendFlowHardwareBack(ref))

        expect(pressBack()).toBe(true)

        expect((ref as { goBack: () => void }).goBack).not.toHaveBeenCalled()
        expect(mockRequestClose).not.toHaveBeenCalled()
    })

    it('passes back through before the navigator is ready', () => {
        renderHook(() => useSendFlowHardwareBack(makeRef({ isReady: false })))

        expect(pressBack()).toBe(false)
        expect(mockRequestClose).not.toHaveBeenCalled()
    })

    it('does not listen off Android', () => {
        vi.mocked(isAndroid).mockReturnValue(false)

        renderHook(() => useSendFlowHardwareBack(makeRef()))

        expect(BackHandler.addEventListener).not.toHaveBeenCalled()
    })

    it('keeps one subscription across renders', () => {
        const ref = makeRef()
        const { rerender } = renderHook(() => useSendFlowHardwareBack(ref))
        rerender()

        expect(BackHandler.addEventListener).toHaveBeenCalledTimes(1)
    })

    it('resubscribes above the navigator once it mounts after the hook', () => {
        const remove = vi.fn()
        vi.mocked(BackHandler.addEventListener).mockReturnValue({
            remove,
        } as never)
        const state = { isReady: false }
        const ref = {
            isReady: () => state.isReady,
            canGoBack: vi.fn(),
            goBack: vi.fn(),
        } as never
        const { rerender } = renderHook(() => useSendFlowHardwareBack(ref))

        state.isReady = true
        rerender()

        expect(BackHandler.addEventListener).toHaveBeenCalledTimes(2)
        expect(remove).toHaveBeenCalledTimes(1)
    })

    it('unsubscribes on unmount', () => {
        const remove = vi.fn()
        vi.mocked(BackHandler.addEventListener).mockReturnValue({
            remove,
        } as never)

        renderHook(() => useSendFlowHardwareBack(makeRef())).unmount()

        expect(remove).toHaveBeenCalledTimes(1)
    })
})
