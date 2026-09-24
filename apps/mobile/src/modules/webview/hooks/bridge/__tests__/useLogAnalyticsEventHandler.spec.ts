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
import { useLogAnalyticsEventHandler } from '../useLogAnalyticsEventHandler'
import {
    TRUSTED,
    bridgeMessage,
    createMockWebview,
    injectedScript,
    languageMockValue,
} from './fixtures'

vi.mock('react-native-webview', () => ({ default: {} }))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => languageMockValue(),
}))

const mockLogEvent = vi.fn()
vi.mock('@perawallet/wallet-extension-provider', () => ({
    usePeraProvider: () => ({ analytics: { logEvent: mockLogEvent } }),
}))

describe('useLogAnalyticsEventHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('forwards the event to the analytics provider', () => {
        const webview = createMockWebview()
        const { result } = renderHook(() =>
            useLogAnalyticsEventHandler(webview),
        )

        result.current(
            bridgeMessage('7', 'logAnalyticsEvent', {
                name: 'test_event',
                payload: { foo: 'bar' },
            }),
            TRUSTED,
        )

        expect(mockLogEvent).toHaveBeenCalledWith('test_event', {
            foo: 'bar',
        })
    })

    it('answers InvalidParams when the payload is missing', () => {
        const webview = createMockWebview()
        const { result } = renderHook(() =>
            useLogAnalyticsEventHandler(webview),
        )

        result.current(
            bridgeMessage('25', 'logAnalyticsEvent', { name: 'test' }),
            TRUSTED,
        )

        expect(mockLogEvent).not.toHaveBeenCalled()
        expect(injectedScript(webview)).toContain('"code":-32602')
    })
})
