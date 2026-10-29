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

import { renderHook, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNetworkStatusStore } from '@modules/network'
import { IntegrityRequiredError } from '@perawallet/wallet-core-shared'
import { useStakingProjectsQuery } from '@perawallet/wallet-core-staking'
import { trackEvent } from '@analytics'
import type { StakingProject } from '@modules/staking/models'
import { useStakingScreen } from '../useStakingScreen'

vi.mock('@analytics', () => ({
    trackEvent: vi.fn(),
    StakingEvent: {
        Open: 'staking_open',
        SelectProject: 'staking_select_project',
    },
    AnalyticsMetadataKey: {
        Name: 'name',
        Url: 'url',
        ChainId: 'chain_id',
    },
}))

const { mockPushWebView } = vi.hoisted(() => ({ mockPushWebView: vi.fn() }))

vi.mock('@modules/webview', async () => ({
    ...(await vi.importActual<
        typeof import('@modules/webview/hooks/handlers-shared')
    >('@modules/webview/hooks/handlers-shared')),
    useWebView: () => ({ pushWebView: mockPushWebView }),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({ request: vi.fn().mockResolvedValue(undefined) }),
}))

vi.mock('@perawallet/wallet-core-staking', () => ({
    useStakingProjectsQuery: vi.fn(),
}))

vi.mock('@modules/staking/hooks', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@modules/staking/hooks')>()
    return {
        ...actual,
        useStakingDisclaimer: () => ({
            isDisclaimerAccepted: true,
            acceptDisclaimer: vi.fn(),
        }),
    }
})

const mockUseStakingProjectsQuery = vi.mocked(useStakingProjectsQuery)

const mockStakingProjectsQuery = (
    overrides: Partial<ReturnType<typeof useStakingProjectsQuery>>,
): void => {
    mockUseStakingProjectsQuery.mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        isPaused: false,
        error: null,
        refetch: vi.fn(),
        ...overrides,
    })
}

const setHasInternet = (hasInternet: boolean): void => {
    useNetworkStatusStore.getState().setHasInternet(hasInternet)
}

describe('useStakingScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        setHasInternet(true)
    })

    it('tracks opening the staking page on the Algorand chain', () => {
        mockStakingProjectsQuery({})

        renderHook(() => useStakingScreen())

        expect(trackEvent).toHaveBeenCalledWith('staking_open', {
            chain_id: 'algorand',
        })
    })

    afterEach(() => {
        setHasInternet(true)
    })

    describe('opening a project', () => {
        const project = (link: string) =>
            ({ title: 'Project', link }) as StakingProject

        it('pushes an https link into the webview', async () => {
            mockStakingProjectsQuery({})
            const { result } = renderHook(() => useStakingScreen())

            await act(() =>
                result.current.handleProjectPress(
                    project('https://project.example/stake'),
                ),
            )

            expect(mockPushWebView).toHaveBeenCalledWith({
                url: 'https://project.example/stake',
                enablePeraConnect: true,
            })
        })

        it('pushes and tracks nothing for an http link', async () => {
            mockStakingProjectsQuery({})
            const { result } = renderHook(() => useStakingScreen())

            await act(() =>
                result.current.handleProjectPress(
                    project('http://project.example/stake'),
                ),
            )

            expect(mockPushWebView).not.toHaveBeenCalled()
            expect(trackEvent).not.toHaveBeenCalledWith(
                'staking_select_project',
                expect.anything(),
            )
        })
    })

    describe('offline', () => {
        it('is offline when the projects query is paused (true-offline, uncached)', () => {
            mockStakingProjectsQuery({
                data: [],
                isLoading: false,
                isError: false,
                isPaused: true,
            })
            const { result } = renderHook(() => useStakingScreen())
            expect(result.current.isOffline).toBe(true)
        })

        it('collapses error to offline when the device has no internet', () => {
            setHasInternet(false)
            mockStakingProjectsQuery({
                data: [],
                isLoading: false,
                isError: true,
                isPaused: false,
            })
            const { result } = renderHook(() => useStakingScreen())
            expect(result.current.isOffline).toBe(true)
            expect(result.current.isError).toBe(true)
        })

        it('keeps the error state reachable in the fake-online regime', () => {
            setHasInternet(true)
            mockStakingProjectsQuery({
                data: [],
                isLoading: false,
                isError: true,
                isPaused: false,
            })
            const { result } = renderHook(() => useStakingScreen())
            expect(result.current.isOffline).toBe(false)
            expect(result.current.isError).toBe(true)
        })

        it('flags a refusal for want of an integrity token', () => {
            mockStakingProjectsQuery({
                isError: true,
                error: new IntegrityRequiredError({
                    code: 'APP_INTEGRITY_TOKEN_REQUIRED',
                    status: 403,
                    hadToken: false,
                }),
            })
            const { result } = renderHook(() => useStakingScreen())
            expect(result.current.isIntegrityBlocked).toBe(true)
        })

        it('does not flag any other failure as an integrity refusal', () => {
            mockStakingProjectsQuery({
                isError: true,
                error: new Error('boom'),
            })
            const { result } = renderHook(() => useStakingScreen())
            expect(result.current.isIntegrityBlocked).toBe(false)
        })

        it('handleRetry refetches when online and short-circuits when offline', () => {
            const refetch = vi.fn()
            setHasInternet(true)
            mockStakingProjectsQuery({
                data: [],
                isLoading: false,
                isError: true,
                isPaused: false,
                refetch,
            })
            const { result } = renderHook(() => useStakingScreen())
            act(() => result.current.handleRetry())
            expect(refetch).toHaveBeenCalledTimes(1)

            setHasInternet(false)
            act(() => result.current.handleRetry())
            expect(refetch).toHaveBeenCalledTimes(1)
        })
    })
})
