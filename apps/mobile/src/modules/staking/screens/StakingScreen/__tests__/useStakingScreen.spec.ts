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
import { useStakingProjectsQuery } from '@perawallet/wallet-core-staking'
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
    },
}))

vi.mock('@modules/webview', () => ({
    useWebView: () => ({ pushWebView: vi.fn() }),
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

    afterEach(() => {
        setHasInternet(true)
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
