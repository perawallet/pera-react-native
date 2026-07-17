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

// @vitest-environment node

import { describe, test, expect } from 'vitest'
import { buildModelViewerHtml, sanitizeModelUrl } from '../modelViewerHtml'

describe('buildModelViewerHtml', () => {
    test('includes the model URL in the src attribute', () => {
        const html = buildModelViewerHtml({
            modelUrl: 'https://example.com/model.glb',
        })

        expect(html).toContain('src="https://example.com/model.glb"')
    })

    test('includes model-viewer script tag', () => {
        const html = buildModelViewerHtml({
            modelUrl: 'https://example.com/model.glb',
        })

        expect(html).toContain('model-viewer.min.js')
    })

    test('includes camera-controls and auto-rotate attributes', () => {
        const html = buildModelViewerHtml({
            modelUrl: 'https://example.com/model.glb',
        })

        expect(html).toContain('camera-controls')
        expect(html).toContain('auto-rotate')
    })

    test('posts a loaded message back to React Native on load', () => {
        const html = buildModelViewerHtml({
            modelUrl: 'https://example.com/model.glb',
        })

        expect(html).toContain("addEventListener('load'")
        expect(html).toContain("type: 'loaded'")
        expect(html).toContain('ReactNativeWebView.postMessage')
    })

    test('throws when the model URL is unsafe', () => {
        expect(() =>
            buildModelViewerHtml({
                modelUrl: 'https://example.com/"><script>alert(1)</script>',
            }),
        ).toThrow()
    })
})

describe('sanitizeModelUrl', () => {
    test('accepts a plain https URL', () => {
        expect(sanitizeModelUrl('https://example.com/model.glb')).toBe(
            'https://example.com/model.glb',
        )
    })

    test('accepts percent-encoded ASCII characters', () => {
        expect(
            sanitizeModelUrl('https://example.com/path%20with%20encoded.glb'),
        ).toBe('https://example.com/path%20with%20encoded.glb')
    })

    test('rejects empty input', () => {
        expect(() => sanitizeModelUrl('')).toThrow()
    })

    test('rejects http URLs', () => {
        expect(() => sanitizeModelUrl('http://example.com/model.glb')).toThrow()
    })

    test('rejects javascript: URLs', () => {
        expect(() =>
            sanitizeModelUrl('javascript:alert(1)' as string),
        ).toThrow()
    })

    test('rejects data: URLs', () => {
        expect(() =>
            sanitizeModelUrl('data:text/html,<script>alert(1)</script>'),
        ).toThrow()
    })

    test('rejects URLs with quote characters that could break out of src', () => {
        expect(() =>
            sanitizeModelUrl(
                'https://example.com/x"><script>alert(1)</script>',
            ),
        ).toThrow()
    })

    test('rejects URLs with whitespace', () => {
        expect(() =>
            sanitizeModelUrl('https://example.com/ model.glb'),
        ).toThrow()
    })

    test('rejects URLs containing non-ASCII / unicode characters', () => {
        expect(() =>
            sanitizeModelUrl('https://exаmple.com/model.glb'),
        ).toThrow()
        expect(() =>
            sanitizeModelUrl('https://example.com/mödel.glb'),
        ).toThrow()
    })

    test('rejects URLs with embedded credentials', () => {
        expect(() =>
            sanitizeModelUrl('https://user:pass@example.com/model.glb'),
        ).toThrow()
    })

    test('rejects URLs longer than the allowed limit', () => {
        const longPath = 'a'.repeat(2050)
        expect(() =>
            sanitizeModelUrl(`https://example.com/${longPath}.glb`),
        ).toThrow()
    })
})
