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
import { useNotifyUserHandler } from '../useNotifyUserHandler'
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

const mockShowToast = vi.fn()
vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mockShowToast }),
}))

describe('useNotifyUserHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('shows a message notification as an info toast', () => {
        const webview = createMockWebview()
        const { result } = renderHook(() => useNotifyUserHandler(webview))

        result.current(
            bridgeMessage('9', 'notifyUser', {
                type: 'message',
                message: 'test message',
            }),
            TRUSTED,
        )

        expect(mockShowToast).toHaveBeenCalledWith({
            title: '',
            body: 'test message',
            type: 'info',
        })
    })

    it('ignores notification types it does not support', () => {
        const webview = createMockWebview()
        const { result } = renderHook(() => useNotifyUserHandler(webview))

        result.current(
            bridgeMessage('9-haptic', 'notifyUser', { type: 'haptic' }),
            TRUSTED,
        )

        expect(mockShowToast).not.toHaveBeenCalled()
        expect(webview.injectJavaScript).not.toHaveBeenCalled()
    })

    it('answers InvalidParams when the type is missing', () => {
        const webview = createMockWebview()
        const { result } = renderHook(() => useNotifyUserHandler(webview))

        result.current(bridgeMessage('22', 'notifyUser'), TRUSTED)

        expect(mockShowToast).not.toHaveBeenCalled()
        expect(injectedScript(webview)).toContain('"code":-32602')
    })
})
