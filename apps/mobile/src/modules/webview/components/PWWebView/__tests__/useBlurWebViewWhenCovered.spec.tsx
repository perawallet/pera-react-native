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

import React, { type PropsWithChildren } from 'react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type WebView from 'react-native-webview'
import { AppLockedProvider } from '@hooks/useIsAppLocked'
import {
    useBottomSheetStore,
    type InternalRequest,
} from '@modules/bottom-sheet'
import {
    BLUR_FOCUSED_ELEMENT_SCRIPT,
    useBlurWebViewWhenCovered,
} from '../useBlurWebViewWhenCovered'

const sheet = (id: string, isVisible = true): InternalRequest => ({
    id,
    contents: null,
    isVisible,
    resolver: () => {},
})

const renderBlur = ({
    isAppLocked = false,
    ownSheetId,
}: { isAppLocked?: boolean; ownSheetId?: string } = {}) => {
    const injectJavaScript = vi.fn()
    const webview = {
        current: { injectJavaScript } as unknown as WebView,
    }
    const wrapper = ({ children }: PropsWithChildren) => (
        <AppLockedProvider value={isAppLocked}>{children}</AppLockedProvider>
    )
    const view = renderHook(
        () => useBlurWebViewWhenCovered(webview, ownSheetId),
        {
            wrapper,
        },
    )
    return { injectJavaScript, ...view }
}

const setSheets = (requests: InternalRequest[]) =>
    act(() => {
        useBottomSheetStore.setState({ requests })
    })

describe('useBlurWebViewWhenCovered', () => {
    afterEach(() => {
        act(() => {
            useBottomSheetStore.setState({ requests: [] })
        })
    })

    it('blurs the focused page element when the app locks', () => {
        const { injectJavaScript } = renderBlur({ isAppLocked: true })

        expect(injectJavaScript).toHaveBeenCalledWith(
            BLUR_FOCUSED_ELEMENT_SCRIPT,
        )
    })

    it('leaves the page alone while the app is unlocked and nothing covers it', () => {
        const { injectJavaScript } = renderBlur()

        expect(injectJavaScript).not.toHaveBeenCalled()
    })

    it('blurs when a sheet opens above the WebView’s own sheet', () => {
        setSheets([sheet('webview')])
        const { injectJavaScript } = renderBlur({ ownSheetId: 'webview' })
        expect(injectJavaScript).not.toHaveBeenCalled()

        setSheets([sheet('webview'), sheet('switch-network')])

        expect(injectJavaScript).toHaveBeenCalledWith(
            BLUR_FOCUSED_ELEMENT_SCRIPT,
        )
    })

    it('ignores a sheet that sits below the WebView’s own', () => {
        setSheets([sheet('earlier'), sheet('webview')])

        const { injectJavaScript } = renderBlur({ ownSheetId: 'webview' })

        expect(injectJavaScript).not.toHaveBeenCalled()
    })

    it('ignores a sheet that is on its way out', () => {
        setSheets([sheet('webview'), sheet('closing', false)])

        const { injectJavaScript } = renderBlur({ ownSheetId: 'webview' })

        expect(injectJavaScript).not.toHaveBeenCalled()
    })

    it('treats any visible sheet as covering a WebView that is not in one', () => {
        setSheets([sheet('connect')])

        const { injectJavaScript } = renderBlur()

        expect(injectJavaScript).toHaveBeenCalledWith(
            BLUR_FOCUSED_ELEMENT_SCRIPT,
        )
    })
})
