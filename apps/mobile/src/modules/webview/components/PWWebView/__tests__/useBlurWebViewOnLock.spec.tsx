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
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type WebView from 'react-native-webview'
import { AppLockedProvider } from '@hooks/useIsAppLocked'
import {
    BLUR_FOCUSED_ELEMENT_SCRIPT,
    useBlurWebViewOnLock,
} from '../useBlurWebViewOnLock'

const renderWithLock = (isAppLocked: boolean) => {
    const injectJavaScript = vi.fn()
    const webview = {
        current: { injectJavaScript } as unknown as WebView,
    }
    const wrapper = ({ children }: PropsWithChildren) => (
        <AppLockedProvider value={isAppLocked}>{children}</AppLockedProvider>
    )
    const view = renderHook(() => useBlurWebViewOnLock(webview), { wrapper })
    return { injectJavaScript, ...view }
}

describe('useBlurWebViewOnLock', () => {
    it('blurs the focused page element when the app locks', () => {
        const { injectJavaScript } = renderWithLock(true)

        expect(injectJavaScript).toHaveBeenCalledWith(
            BLUR_FOCUSED_ELEMENT_SCRIPT,
        )
    })

    it('leaves the page alone while the app is unlocked', () => {
        const { injectJavaScript } = renderWithLock(false)

        expect(injectJavaScript).not.toHaveBeenCalled()
    })
})
