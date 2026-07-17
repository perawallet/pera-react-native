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

import { describe, it, expect } from 'vitest'
import { render } from '@test-utils/render'
// Import the exact web filename — vitest has no Metro platform resolution,
// so a bare '../PWStaticWebView' specifier would load the react-native-webview
// module instead (as the native PWStaticWebView.spec.tsx does).
import { PWStaticWebView } from '../PWStaticWebView.web'

describe('PWStaticWebView (web)', () => {
    it('renders bundled HTML via srcDoc', () => {
        const { container } = render(
            <PWStaticWebView source={{ html: '<p>terms</p>' }} />,
        )

        const iframe = container.querySelector('iframe')
        expect(iframe).not.toBeNull()
        expect(iframe?.getAttribute('srcdoc')).toBe('<p>terms</p>')
        expect(iframe?.getAttribute('src')).toBeNull()
    })

    it('renders a remote URL via src', () => {
        const { container } = render(
            <PWStaticWebView source={{ uri: 'https://example.com/terms' }} />,
        )

        const iframe = container.querySelector('iframe')
        expect(iframe?.getAttribute('src')).toBe('https://example.com/terms')
        expect(iframe?.getAttribute('srcdoc')).toBeNull()
    })

    it('sandboxes bundled HTML with no allowances — static trusted content needs no scripts', () => {
        const { container } = render(
            <PWStaticWebView source={{ html: '<p>terms</p>' }} />,
        )

        expect(container.querySelector('iframe')?.getAttribute('sandbox')).toBe(
            '',
        )
    })

    it('sandboxes a remote uri with allow-same-origin allow-scripts — needed to render, equivalent to an ordinary cross-origin iframe', () => {
        const { container } = render(
            <PWStaticWebView source={{ uri: 'https://example.com/terms' }} />,
        )

        expect(container.querySelector('iframe')?.getAttribute('sandbox')).toBe(
            'allow-same-origin allow-scripts',
        )
    })
})
