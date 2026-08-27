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

const { mockShowToast, mockSetOnPeraBackendUnavailable } = vi.hoisted(() => ({
    mockShowToast: vi.fn(),
    mockSetOnPeraBackendUnavailable: vi.fn(),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: () => ({ showToast: mockShowToast }),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => ({ t: (key: string) => key }),
}))

vi.mock('../queryClient', () => ({
    setOnPeraBackendUnavailable: mockSetOnPeraBackendUnavailable,
}))

import { usePeraServiceUnavailableToast } from '../usePeraServiceUnavailableToast'

describe('usePeraServiceUnavailableToast', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('registers a handler and toasts once per network (deduped)', () => {
        let capturedHandler: ((network: string) => void) | undefined
        mockSetOnPeraBackendUnavailable.mockImplementation(
            (handler: (network: string) => void) => {
                capturedHandler = handler
                return vi.fn()
            },
        )

        renderHook(() => usePeraServiceUnavailableToast())

        expect(mockSetOnPeraBackendUnavailable).toHaveBeenCalledTimes(1)

        capturedHandler?.('betanet')
        capturedHandler?.('betanet')
        capturedHandler?.('custom')

        expect(mockShowToast).toHaveBeenCalledTimes(2)
        expect(mockShowToast).toHaveBeenNthCalledWith(1, {
            title: 'common.network_unavailable.title',
            body: 'common.network_unavailable.body',
            type: 'info',
        })
        expect(mockShowToast).toHaveBeenNthCalledWith(2, {
            title: 'common.network_unavailable.title',
            body: 'common.network_unavailable.body',
            type: 'info',
        })
    })

    it('unsubscribes the handler on unmount', () => {
        const unsubscribe = vi.fn()
        mockSetOnPeraBackendUnavailable.mockImplementation(() => unsubscribe)

        const { unmount } = renderHook(() => usePeraServiceUnavailableToast())
        unmount()

        expect(unsubscribe).toHaveBeenCalled()
    })
})
