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

import type { ReactElement } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { BottomSheetOptions } from '@modules/bottom-sheet'
import type { WebViewRequest } from '../../../hooks'
import { useWebViewOverlay } from '../useWebViewOverlay'

type SheetRequest = {
    id?: string
    contents: ReactElement<{ onClose: () => void }>
    options?: BottomSheetOptions
}

const mocks = vi.hoisted(() => ({
    request: vi.fn((_request: SheetRequest) => Promise.resolve()),
    dismiss: vi.fn(),
    removeWebView: vi.fn(),
    openWebViews: [] as WebViewRequest[],
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mocks.request,
        dismiss: mocks.dismiss,
    }),
}))

vi.mock('../../../hooks', () => ({
    useWebViewStack: () => ({
        openWebViews: mocks.openWebViews,
        removeWebView: mocks.removeWebView,
    }),
}))

const view = { id: 'view-1', url: 'https://example.test' }

const pendingSheet = () => {
    let settle = () => {}
    mocks.request.mockReturnValueOnce(
        new Promise<void>(resolve => {
            settle = resolve
        }),
    )
    return () => settle()
}

describe('useWebViewOverlay', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.openWebViews = [view]
    })

    // The sheet must not avoid the keyboard on top of the inset the WebView
    // already applies to its own content.
    it('requests the webview sheet with keyboard avoidance off', () => {
        renderHook(() => useWebViewOverlay())

        expect(mocks.request).toHaveBeenCalledTimes(1)
        const sheet = mocks.request.mock.calls[0]?.[0]
        expect(sheet?.id).toBe('view-1')
        expect(sheet?.options?.avoidKeyboard).toBe(false)
        expect(sheet?.options?.size).toBe('full')
    })

    it('requests one sheet per new entry and does not re-request on store updates', () => {
        pendingSheet()
        const { rerender } = renderHook(() => useWebViewOverlay())

        mocks.openWebViews = [view, { id: 'view-2', url: 'https://two.test' }]
        rerender()

        expect(mocks.request.mock.calls.map(([sheet]) => sheet.id)).toEqual([
            'view-1',
            'view-2',
        ])
    })

    it("routes close to the entry's onCloseRequested when it has one", () => {
        pendingSheet()
        const onCloseRequested = vi.fn()
        mocks.openWebViews = [{ ...view, onCloseRequested }]
        renderHook(() => useWebViewOverlay())

        mocks.request.mock.calls[0]?.[0].contents.props.onClose()

        expect(onCloseRequested).toHaveBeenCalledTimes(1)
        expect(mocks.removeWebView).not.toHaveBeenCalled()
    })

    it('routes close to removeWebView when the entry has no onCloseRequested', () => {
        pendingSheet()
        renderHook(() => useWebViewOverlay())

        mocks.request.mock.calls[0]?.[0].contents.props.onClose()

        expect(mocks.removeWebView).toHaveBeenCalledWith('view-1')
    })

    it('removes the entry from the store when its sheet settles', async () => {
        const settle = pendingSheet()
        renderHook(() => useWebViewOverlay())
        expect(mocks.removeWebView).not.toHaveBeenCalled()

        await act(async () => settle())

        expect(mocks.removeWebView).toHaveBeenCalledWith('view-1')
    })

    it('dismisses the sheet of an entry that left the store', () => {
        pendingSheet()
        const { rerender } = renderHook(() => useWebViewOverlay())

        mocks.openWebViews = []
        rerender()

        expect(mocks.dismiss).toHaveBeenCalledWith('view-1')
    })
})
