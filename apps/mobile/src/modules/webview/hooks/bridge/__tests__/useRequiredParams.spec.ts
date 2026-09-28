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

import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useRequiredParams } from '../useRequiredParams'
import {
    bridgeMessage,
    createMockWebview,
    injectedScript,
    languageMockValue,
} from './fixtures'

vi.mock('react-native-webview', () => ({ default: {} }))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({
        ...languageMockValue(),
        t: (key: string, params?: Record<string, string>) =>
            `${key}:${params?.params}`,
    }),
}))

describe('useRequiredParams', () => {
    it('passes a message carrying every required param without answering the page', () => {
        const webview = createMockWebview()
        const { result } = renderHook(() => useRequiredParams(webview))

        const isValid = result.current(
            ['name', 'payload'],
            bridgeMessage('1', 'logAnalyticsEvent', {
                name: 'event',
                payload: { a: 1 },
            }),
        )

        expect(isValid).toBe(true)
        expect(webview.injectJavaScript).not.toHaveBeenCalled()
    })

    it('answers InvalidParams naming the first missing param', () => {
        const webview = createMockWebview()
        const { result } = renderHook(() => useRequiredParams(webview))

        const isValid = result.current(
            ['name', 'payload'],
            bridgeMessage('2', 'logAnalyticsEvent', { name: 'event' }),
        )

        expect(isValid).toBe(false)
        const sent = injectedScript(webview)
        expect(sent).toContain('"id":"2"')
        expect(sent).toContain(
            '"error":{"code":-32602,"message":"errors.webview.invalid_params:payload"}',
        )
    })

    it('treats a falsy param as missing', () => {
        const webview = createMockWebview()
        const { result } = renderHook(() => useRequiredParams(webview))

        const isValid = result.current(
            ['uri'],
            bridgeMessage('3', 'canOpenURI', { uri: '' }),
        )

        expect(isValid).toBe(false)
        expect(injectedScript(webview)).toContain('invalid_params:uri')
    })
})
