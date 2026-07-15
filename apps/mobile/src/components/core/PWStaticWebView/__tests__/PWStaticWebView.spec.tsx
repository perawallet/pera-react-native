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

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from '@test-utils/render'
import { PWStaticWebView } from '../PWStaticWebView'

const { webViewSpy } = vi.hoisted(() => ({ webViewSpy: vi.fn() }))

vi.mock('react-native-webview', () => ({
    WebView: (props: Record<string, unknown>) => {
        webViewSpy(props)
        return React.createElement('div', {
            'data-testid': (props.testID as string) ?? 'static-webview',
        })
    },
}))

describe('PWStaticWebView', () => {
    it('enables Android nested scrolling on the underlying WebView', () => {
        // The whole reason this wrapper exists: WebView content does not scroll
        // on Android inside a gesture host unless nestedScrollEnabled is set.
        render(<PWStaticWebView source={{ uri: 'https://example.com' }} />)

        expect(webViewSpy).toHaveBeenCalledWith(
            expect.objectContaining({ nestedScrollEnabled: true }),
        )
    })

    it('forwards the source and caller props to the WebView', () => {
        const onMessage = vi.fn()
        const source = { html: '<p>terms</p>', baseUrl: 'https://example.com' }

        render(
            <PWStaticWebView
                source={source}
                injectedJavaScript='true;'
                onMessage={onMessage}
            />,
        )

        expect(webViewSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                source,
                injectedJavaScript: 'true;',
                onMessage,
            }),
        )
    })
})
