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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRekeyIntroScreen } from '../useRekeyIntroScreen'

const mockGoBack = vi.fn()
vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: () => ({
        goBack: mockGoBack,
    }),
}))

const mockPushWebView = vi.fn()
vi.mock('@modules/webview', () => ({
    useWebView: () => ({
        pushWebView: mockPushWebView,
    }),
}))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: {
        rekeyToStandardSupportUrl:
            'https://support.perawallet.app/en/article/rekey/',
    },
}))

describe('useRekeyIntroScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('handleStartProcess goes back to the previous screen (placeholder)', () => {
        const { result } = renderHook(() => useRekeyIntroScreen())

        act(() => {
            result.current.handleStartProcess()
        })

        expect(mockGoBack).toHaveBeenCalledTimes(1)
    })

    it('handleLearnMore opens the support article in the in-app webview', () => {
        const { result } = renderHook(() => useRekeyIntroScreen())

        act(() => {
            result.current.handleLearnMore()
        })

        expect(mockPushWebView).toHaveBeenCalledWith({
            url: 'https://support.perawallet.app/en/article/rekey/',
        })
    })
})
