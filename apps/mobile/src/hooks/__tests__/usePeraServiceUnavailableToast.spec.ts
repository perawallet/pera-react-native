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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { PeraServiceUnavailableError } from '@perawallet/wallet-core-shared'

const { mockShowError, mockSetOnPeraBackendUnavailable } = vi.hoisted(() => ({
    mockShowError: vi.fn(),
    mockSetOnPeraBackendUnavailable: vi.fn(),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mockShowError }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('@providers/queryClient', () => ({
    setOnPeraBackendUnavailable: mockSetOnPeraBackendUnavailable,
}))

import { usePeraServiceUnavailableToast } from '../usePeraServiceUnavailableToast'

describe('usePeraServiceUnavailableToast', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('registers a handler that toasts once per network, deduped', () => {
        let capturedHandler:
            | ((error: PeraServiceUnavailableError) => void)
            | undefined
        mockSetOnPeraBackendUnavailable.mockImplementation(
            (handler: (error: PeraServiceUnavailableError) => void) => {
                capturedHandler = handler
                return vi.fn()
            },
        )

        renderHook(() => usePeraServiceUnavailableToast())

        expect(mockSetOnPeraBackendUnavailable).toHaveBeenCalledTimes(1)

        const betanet = new PeraServiceUnavailableError('betanet')
        const custom = new PeraServiceUnavailableError('custom')

        capturedHandler?.(betanet)
        capturedHandler?.(betanet)
        capturedHandler?.(custom)
        capturedHandler?.(betanet)

        expect(mockShowError).toHaveBeenCalledTimes(2)
        expect(mockShowError).toHaveBeenNthCalledWith(
            1,
            betanet,
            'common.network_unavailable.title',
        )
        expect(mockShowError).toHaveBeenNthCalledWith(
            2,
            custom,
            'common.network_unavailable.title',
        )
    })

    it('unsubscribes the handler on unmount', () => {
        const unsubscribe = vi.fn()
        mockSetOnPeraBackendUnavailable.mockImplementation(() => unsubscribe)

        const { unmount } = renderHook(() => usePeraServiceUnavailableToast())
        unmount()

        expect(unsubscribe).toHaveBeenCalled()
    })
})
