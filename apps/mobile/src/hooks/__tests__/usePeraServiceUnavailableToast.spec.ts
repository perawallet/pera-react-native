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
import { setPeraBackendSwitch } from '@perawallet/wallet-core-config'
import { PeraServiceUnavailableError } from '@perawallet/wallet-core-shared'

const { mockShowError, mockSetOnPeraBackendUnavailable } = vi.hoisted(() => ({
    mockShowError: vi.fn(),
    mockSetOnPeraBackendUnavailable: vi.fn(),
}))

vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mockShowError }),
}))

vi.mock('@hooks/useLanguage')

vi.mock('@providers/queryClient', () => ({
    setOnPeraBackendUnavailable: mockSetOnPeraBackendUnavailable,
}))

import { usePeraServiceUnavailableToast } from '../usePeraServiceUnavailableToast'

describe('usePeraServiceUnavailableToast', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('registers a handler that toasts once per scope, deduped', () => {
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

        const betanet = new PeraServiceUnavailableError({
            chainId: 'algorand',
            networkId: 'betanet',
        })
        const custom = new PeraServiceUnavailableError({
            chainId: 'algorand',
            networkId: 'custom',
        })
        // Same network id on another chain: a different scope, so it gets its
        // own toast.
        const fixtureBetanet = new PeraServiceUnavailableError({
            chainId: 'fixture' as unknown as NonNullable<
                PeraServiceUnavailableError['scope']
            >['chainId'],
            networkId: 'betanet',
        })

        capturedHandler?.(betanet)
        capturedHandler?.(betanet)
        const developer = new PeraServiceUnavailableError({
            deployment: 'developer',
        })

        capturedHandler?.(custom)
        capturedHandler?.(fixtureBetanet)
        capturedHandler?.(betanet)
        capturedHandler?.(developer)
        capturedHandler?.(developer)

        expect(mockShowError).toHaveBeenCalledTimes(4)
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
        expect(mockShowError).toHaveBeenNthCalledWith(
            3,
            fixtureBetanet,
            'common.network_unavailable.title',
        )
    })

    it('stays silent for a refusal by the chain kill switch, whose scope is on a network with a backend', () => {
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
        const scope = { chainId: 'algorand', networkId: 'mainnet' } as const

        capturedHandler?.(
            new PeraServiceUnavailableError(scope, undefined, {
                isSwitchedOff: true,
            }),
        )
        expect(mockShowError).not.toHaveBeenCalled()

        // The switch refusing a scope doesn't use up that scope's notice.
        const betanet = new PeraServiceUnavailableError(scope)
        capturedHandler?.(betanet)
        expect(mockShowError).toHaveBeenCalledWith(
            betanet,
            'common.network_unavailable.title',
        )
    })

    it('stays silent for an error an adapter raised itself while the chain kill switch is on', () => {
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
        setPeraBackendSwitch(chainId => chainId === 'ethereum')

        try {
            capturedHandler?.(
                new PeraServiceUnavailableError(
                    { chainId: 'ethereum', networkId: 'mainnet' },
                    'assets',
                ),
            )
            expect(mockShowError).not.toHaveBeenCalled()

            const algorand = new PeraServiceUnavailableError({
                chainId: 'algorand',
                networkId: 'betanet',
            })
            capturedHandler?.(algorand)
            expect(mockShowError).toHaveBeenCalledWith(
                algorand,
                'common.network_unavailable.title',
            )
        } finally {
            setPeraBackendSwitch(() => false)
        }
    })

    it('unsubscribes the handler on unmount', () => {
        const unsubscribe = vi.fn()
        mockSetOnPeraBackendUnavailable.mockImplementation(() => unsubscribe)

        const { unmount } = renderHook(() => usePeraServiceUnavailableToast())
        unmount()

        expect(unsubscribe).toHaveBeenCalled()
    })
})
