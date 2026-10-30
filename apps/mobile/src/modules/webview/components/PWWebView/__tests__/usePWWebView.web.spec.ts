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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePWWebView } from '../usePWWebView.web'
import type { PWWebViewProps } from '../PWWebView'

const mocks = vi.hoisted(() => ({
    createDiscoverBridgeHost: vi.fn(),
    openExternalTab: vi.fn(),
    handleMessage: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-browser-runtime', () => ({
    createDiscoverBridgeHost: mocks.createDiscoverBridgeHost,
    openExternalTab: mocks.openExternalTab,
}))

vi.mock('../../../hooks/usePeraWebviewInterface', () => ({
    usePeraWebviewInterface: () => ({ handleMessage: mocks.handleMessage }),
}))

vi.mock('../../../hooks/useNotifyWebViewOnContextChange', () => ({
    useNotifyWebViewOnContextChange: vi.fn(),
}))

vi.mock('../../../hooks/useContextFingerprints', () => ({
    useContextFingerprints: () => ({}),
}))

vi.mock('@modules/network', () => ({
    useNetworkStatus: () => ({ hasInternet: true }),
}))

const props: PWWebViewProps = {
    url: 'https://good.xyz/landing',
    enablePeraConnect: false,
}

describe('usePWWebView (web)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.createDiscoverBridgeHost.mockReturnValue({
            dispose: vi.fn(),
            post: vi.fn(),
        })
    })

    it('waits for the frame to load', () => {
        const { result } = renderHook(() => usePWWebView(props))

        expect(result.current.status).toBe('loading')
    })

    it('reports a failed frame and retries from the loading state', () => {
        const { result } = renderHook(() => usePWWebView(props))

        act(() => result.current.handleError())
        expect(result.current.status).toBe('error')

        act(() => result.current.handleRetry())
        expect(result.current.status).toBe('loading')
    })

    it('carries the bridge token in the frame url', () => {
        const { result } = renderHook(() => usePWWebView(props))

        expect(result.current.src).toContain('peraBridgeToken=')
        expect(result.current.src).toContain('good.xyz')
    })

    it('remounts the frame on a retry', () => {
        const { result } = renderHook(() => usePWWebView(props))
        const first = result.current.reloadNonce

        act(() => result.current.handleRetry())

        expect(result.current.reloadNonce).toBe(first + 1)
    })
})
