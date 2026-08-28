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
import { render } from '@test-utils/render'
import type { BottomSheetOptions } from '@modules/bottom-sheet'

const mocks = vi.hoisted(() => ({
    request: vi.fn((_request: { options?: BottomSheetOptions }) =>
        Promise.resolve(),
    ),
    dismiss: vi.fn(),
    removeWebView: vi.fn(),
    openWebViews: [{ id: 'view-1', url: 'https://example.test' }] as unknown[],
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

import { WebViewOverlay } from '../WebViewOverlay'

describe('WebViewOverlay', () => {
    beforeEach(() => {
        mocks.request.mockClear()
    })

    // The sheet must not avoid the keyboard on top of the inset the WebView
    // already applies to its own content (PERA-4708).
    it('requests the webview sheet with keyboard avoidance off', () => {
        render(<WebViewOverlay />)

        expect(mocks.request).toHaveBeenCalledTimes(1)
        const options = mocks.request.mock.calls[0]?.[0].options
        expect(options?.avoidKeyboard).toBe(false)
        expect(options?.size).toBe('full')
    })
})
