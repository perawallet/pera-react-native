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

import React from 'react'
import { Text } from 'react-native'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IntegrityAccessState } from '@perawallet/wallet-core-browser-runtime'
import { render, screen, fireEvent } from '@test-utils/render'
import { OfflineTolerantView } from '../OfflineTolerantView'

const mockUseIntegrityAccessState = vi.hoisted(() => vi.fn())
const mockRetry = vi.hoisted(() => vi.fn())
const mockVerify = vi.hoisted(() => vi.fn())

vi.mock('@hooks/useLanguage')
vi.mock('@hooks/useIntegrityAccessState', () => ({
    useIntegrityAccessState: mockUseIntegrityAccessState,
}))

const Children = () => <Text>children-content</Text>

const setAccessState = (state: IntegrityAccessState) => {
    mockUseIntegrityAccessState.mockReturnValue({
        state,
        retry: mockRetry,
        verify: mockVerify,
    })
}

const degraded = (
    reason: 'service' | 'verification' | 'blocked',
): IntegrityAccessState => ({
    status: 'degraded',
    reason,
    cause: 'mint-5xx',
    nextAttemptAt: null,
})

describe('OfflineTolerantView', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        setAccessState({ status: 'ready', expiresAt: Number.MAX_SAFE_INTEGER })
    })

    it('renders children when online and healthy', () => {
        render(
            <OfflineTolerantView isOffline={false}>
                <Children />
            </OfflineTolerantView>,
        )

        expect(screen.getByText('children-content')).toBeTruthy()
        expect(screen.queryByText('common.offline_mode')).toBeNull()
    })

    it('replaces children with the offline surface when offline', () => {
        render(
            <OfflineTolerantView isOffline>
                <Children />
            </OfflineTolerantView>,
        )

        expect(screen.getByText('common.offline_mode')).toBeTruthy()
        expect(screen.getByText('common.offline_refresh_body')).toBeTruthy()
        expect(screen.queryByText('children-content')).toBeNull()
    })

    it('shows the error surface when the request failed while online', () => {
        render(
            <OfflineTolerantView
                isOffline={false}
                isError
            >
                <Children />
            </OfflineTolerantView>,
        )

        expect(screen.getByText('common.error.title')).toBeTruthy()
        expect(screen.queryByText('children-content')).toBeNull()
    })

    it('prefers the offline surface over the error surface', () => {
        render(
            <OfflineTolerantView
                isOffline
                isError
            >
                <Children />
            </OfflineTolerantView>,
        )

        expect(screen.getByText('common.offline_mode')).toBeTruthy()
        expect(screen.queryByText('common.error.title')).toBeNull()
    })

    it('leaves the error arm to the caller when isError is not passed', () => {
        render(
            <OfflineTolerantView isOffline={false}>
                <Children />
            </OfflineTolerantView>,
        )

        expect(screen.getByText('children-content')).toBeTruthy()
    })

    it('renders no retry button when no handler is given', () => {
        render(
            <OfflineTolerantView isOffline>
                <Children />
            </OfflineTolerantView>,
        )

        expect(screen.queryByText('common.retry.label')).toBeNull()
    })

    it('calls onRetry from the offline surface', () => {
        const onRetry = vi.fn()
        render(
            <OfflineTolerantView
                isOffline
                onRetry={onRetry}
            >
                <Children />
            </OfflineTolerantView>,
        )

        fireEvent.click(screen.getByText('common.retry.label'))

        expect(onRetry).toHaveBeenCalledTimes(1)
    })

    it('swaps the retry label for a spinner while a retry is in flight', () => {
        render(
            <OfflineTolerantView
                isOffline={false}
                isError
                onRetry={vi.fn()}
                isRetrying
            >
                <Children />
            </OfflineTolerantView>,
        )

        expect(screen.getByText('common.error.title')).toBeTruthy()
        expect(screen.queryByText('common.retry.label')).toBeNull()
    })

    it('uses the surface-specific retry label and error body when provided', () => {
        render(
            <OfflineTolerantView
                isOffline={false}
                isError
                onRetry={vi.fn()}
                retryLabel='staking.retry'
                errorBody='custom-error-body'
            >
                <Children />
            </OfflineTolerantView>,
        )

        expect(screen.getByText('staking.retry')).toBeTruthy()
        expect(screen.getByText('custom-error-body')).toBeTruthy()
    })

    it('shows the network-unavailable surface with no retry button, even when a handler is given', () => {
        render(
            <OfflineTolerantView
                isOffline={false}
                isUnavailable
                onRetry={vi.fn()}
            >
                <Children />
            </OfflineTolerantView>,
        )

        expect(
            screen.getByText('common.network_unavailable.title'),
        ).toBeTruthy()
        expect(screen.getByText('common.network_unavailable.body')).toBeTruthy()
        expect(screen.queryByText('common.retry.label')).toBeNull()
        expect(screen.queryByText('children-content')).toBeNull()
    })

    it('uses the surface-specific unavailable body when provided', () => {
        render(
            <OfflineTolerantView
                isOffline={false}
                isUnavailable
                unavailableBody='custom-unavailable-body'
            >
                <Children />
            </OfflineTolerantView>,
        )

        expect(screen.getByText('custom-unavailable-body')).toBeTruthy()
        expect(screen.queryByText('common.network_unavailable.body')).toBeNull()
    })

    it('uses the surface-specific unavailable title when provided', () => {
        render(
            <OfflineTolerantView
                isOffline={false}
                isUnavailable
                unavailableTitle='custom-unavailable-title'
            >
                <Children />
            </OfflineTolerantView>,
        )

        expect(screen.getByText('custom-unavailable-title')).toBeTruthy()
        expect(
            screen.queryByText('common.network_unavailable.title'),
        ).toBeNull()
    })

    it('prefers the network-unavailable surface over offline and error', () => {
        render(
            <OfflineTolerantView
                isOffline
                isError
                isUnavailable
            >
                <Children />
            </OfflineTolerantView>,
        )

        expect(
            screen.getByText('common.network_unavailable.title'),
        ).toBeTruthy()
        expect(screen.queryByText('common.offline_mode')).toBeNull()
        expect(screen.queryByText('common.error.title')).toBeNull()
    })

    it('applies the per-arm testIDs', () => {
        const { rerender } = render(
            <OfflineTolerantView
                isOffline
                offlineTestID='surface-offline'
                errorTestID='surface-error'
            >
                <Children />
            </OfflineTolerantView>,
        )

        expect(screen.getByTestId('surface-offline')).toBeTruthy()

        rerender(
            <OfflineTolerantView
                isOffline={false}
                isError
                offlineTestID='surface-offline'
                errorTestID='surface-error'
            >
                <Children />
            </OfflineTolerantView>,
        )

        expect(screen.getByTestId('surface-error')).toBeTruthy()
    })

    describe('integrity arm', () => {
        it('asks for verification and starts it when the check needs the user', () => {
            setAccessState(degraded('verification'))
            render(
                <OfflineTolerantView
                    isOffline={false}
                    isIntegrityBlocked
                >
                    <Children />
                </OfflineTolerantView>,
            )

            fireEvent.click(screen.getByText('integrityCheck.banner.verify'))

            expect(
                screen.getByText('integrityCheck.surface.verify_title'),
            ).toBeTruthy()
            expect(
                screen.getByText('integrityCheck.surface.verify_body'),
            ).toBeTruthy()
            expect(screen.queryByText('integrityCheck.banner.retry')).toBeNull()
            expect(screen.queryByText('children-content')).toBeNull()
            expect(mockVerify).toHaveBeenCalledTimes(1)
            expect(mockRetry).not.toHaveBeenCalled()
        })

        it('explains a blocked installation with no button, since retrying cannot help', () => {
            setAccessState(degraded('blocked'))
            render(
                <OfflineTolerantView
                    isOffline={false}
                    isIntegrityBlocked
                    onRetry={vi.fn()}
                >
                    <Children />
                </OfflineTolerantView>,
            )

            expect(
                screen.getByText('integrityCheck.surface.service_title'),
            ).toBeTruthy()
            expect(
                screen.getByText('integrityCheck.surface.blocked_body'),
            ).toBeTruthy()
            expect(screen.queryByText('integrityCheck.banner.retry')).toBeNull()
            expect(
                screen.queryByText('integrityCheck.banner.verify'),
            ).toBeNull()
            expect(screen.queryByText('common.retry.label')).toBeNull()
        })

        it.each<[string, IntegrityAccessState]>([
            ['a service outage', degraded('service')],
            ['a pending token', { status: 'pending' }],
            ['a running check', { status: 'checking', surface: 'frame' }],
            ['a check waiting on a click', { status: 'needs-interaction' }],
        ])(
            'shows the service copy and retries the mint for %s',
            (_label, state) => {
                setAccessState(state)
                const onRetry = vi.fn()
                render(
                    <OfflineTolerantView
                        isOffline={false}
                        isIntegrityBlocked
                        onRetry={onRetry}
                    >
                        <Children />
                    </OfflineTolerantView>,
                )

                fireEvent.click(screen.getByText('integrityCheck.banner.retry'))

                expect(
                    screen.getByText('integrityCheck.surface.service_title'),
                ).toBeTruthy()
                expect(
                    screen.getByText('integrityCheck.surface.service_body'),
                ).toBeTruthy()
                expect(mockRetry).toHaveBeenCalledTimes(1)
                expect(onRetry).not.toHaveBeenCalled()
            },
        )

        it("retries the caller's query once the token has landed", () => {
            setAccessState({
                status: 'ready',
                expiresAt: Number.MAX_SAFE_INTEGER,
            })
            const onRetry = vi.fn()
            render(
                <OfflineTolerantView
                    isOffline={false}
                    isIntegrityBlocked
                    onRetry={onRetry}
                >
                    <Children />
                </OfflineTolerantView>,
            )

            fireEvent.click(screen.getByText('integrityCheck.banner.retry'))

            expect(
                screen.getByText('integrityCheck.surface.service_title'),
            ).toBeTruthy()
            expect(onRetry).toHaveBeenCalledTimes(1)
            expect(mockRetry).not.toHaveBeenCalled()
        })

        it('falls back to retrying the mint once the token has landed when the caller has no retry', () => {
            setAccessState({
                status: 'ready',
                expiresAt: Number.MAX_SAFE_INTEGER,
            })
            render(
                <OfflineTolerantView
                    isOffline={false}
                    isIntegrityBlocked
                >
                    <Children />
                </OfflineTolerantView>,
            )

            fireEvent.click(screen.getByText('integrityCheck.banner.retry'))

            expect(mockRetry).toHaveBeenCalledTimes(1)
        })

        it('yields to the offline surface', () => {
            setAccessState(degraded('service'))
            render(
                <OfflineTolerantView
                    isOffline
                    isIntegrityBlocked
                    isError
                >
                    <Children />
                </OfflineTolerantView>,
            )

            expect(screen.getByText('common.offline_mode')).toBeTruthy()
            expect(
                screen.queryByText('integrityCheck.surface.service_title'),
            ).toBeNull()
        })

        it('outranks the generic error surface', () => {
            setAccessState(degraded('service'))
            render(
                <OfflineTolerantView
                    isOffline={false}
                    isIntegrityBlocked
                    isError
                >
                    <Children />
                </OfflineTolerantView>,
            )

            expect(
                screen.getByText('integrityCheck.surface.service_title'),
            ).toBeTruthy()
            expect(screen.queryByText('common.error.title')).toBeNull()
        })

        it('yields to the network-unavailable surface', () => {
            setAccessState(degraded('service'))
            render(
                <OfflineTolerantView
                    isOffline
                    isUnavailable
                    isIntegrityBlocked
                    isError
                >
                    <Children />
                </OfflineTolerantView>,
            )

            expect(
                screen.getByText('common.network_unavailable.title'),
            ).toBeTruthy()
            expect(
                screen.queryByText('integrityCheck.surface.service_title'),
            ).toBeNull()
        })
    })
})
