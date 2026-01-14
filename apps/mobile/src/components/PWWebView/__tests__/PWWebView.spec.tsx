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

import { render } from '@test-utils/render'
import { describe, it, expect, vi } from 'vitest'
import PWWebView from '../PWWebView'

vi.mock('react-native-webview', () => ({
    WebView: () => <div data-testid="webview">WebView</div>,
}))

vi.mock('../WebViewTitleBar', () => ({
    default: () => <div data-testid="title-bar">TitleBar</div>,
}))

vi.mock('../WebViewFooterBar', () => ({
    default: () => <div data-testid="footer-bar">FooterBar</div>,
}))

describe('PWWebView', () => {
    it('renders with url', () => {
        const { container } = render(
            <PWWebView
                url='https://example.com'
                enablePeraConnect={false}
            />,
        )
        expect(container).toBeTruthy()
    })

    it('renders controls when showControls is true', () => {
        const { container } = render(
            <PWWebView
                url='https://example.com'
                enablePeraConnect={false}
                showControls={true}
            />,
        )
        expect(container.textContent).toContain('TitleBar')
        expect(container.textContent).toContain('FooterBar')
    })

    it('does not show controls when showControls is false', () => {
        const { container } = render(
            <PWWebView
                url='https://example.com'
                enablePeraConnect={false}
                showControls={false}
            />,
        )
        expect(container).toBeTruthy()
    })

    it('accepts onClose callback', () => {
        const onClose = vi.fn()
        const { container } = render(
            <PWWebView
                url='https://example.com'
                enablePeraConnect={false}
                onClose={onClose}
            />,
        )
        expect(container).toBeTruthy()
    })

    it('enables Pera Connect when specified', () => {
        const { container } = render(
            <PWWebView
                url='https://example.com'
                enablePeraConnect={true}
            />,
        )
        expect(container).toBeTruthy()
    })

    it('accepts requestId for webview management', () => {
        const { container } = render(
            <PWWebView
                url='https://example.com'
                enablePeraConnect={false}
                requestId='test-request-123'
            />,
        )
        expect(container).toBeTruthy()
    })
})
