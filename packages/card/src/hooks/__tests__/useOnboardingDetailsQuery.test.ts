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
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const mockUseNetwork = vi.hoisted(() => vi.fn())
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: mockUseNetwork,
}))

const { fetchOnboardingDetails } = vi.hoisted(() => ({
    fetchOnboardingDetails: vi.fn(),
}))
vi.mock('../../api/onboarding', () => ({ fetchOnboardingDetails }))

import { useOnboardingDetailsQuery } from '../useOnboardingDetailsQuery'
import { VerificationState } from '../../models'

describe('useOnboardingDetailsQuery', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        vi.clearAllMocks()
        mockUseNetwork.mockReturnValue({ network: 'mainnet' })
    })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    it('surfaces the polled verification state', async () => {
        fetchOnboardingDetails.mockResolvedValue({
            verificationState: VerificationState.Pending,
        })

        const { result } = renderHook(
            () => useOnboardingDetailsQuery({ onboardingId: 'ob_1' }),
            { wrapper },
        )

        await waitFor(() =>
            expect(result.current.data?.verificationState).toBe(
                VerificationState.Pending,
            ),
        )
        expect(fetchOnboardingDetails).toHaveBeenCalledWith(
            expect.objectContaining({
                onboardingId: 'ob_1',
                network: 'mainnet',
            }),
        )
    })

    it('stays idle while the onboarding id is null', async () => {
        const { result } = renderHook(
            () => useOnboardingDetailsQuery({ onboardingId: null }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(fetchOnboardingDetails).not.toHaveBeenCalled()
        expect(result.current.data?.verificationState).toBeUndefined()
    })

    it('consults a function refetchInterval to schedule polling', async () => {
        fetchOnboardingDetails.mockResolvedValue({
            verificationState: VerificationState.Pending,
        })
        const refetchInterval = vi.fn(() => false as const)

        const { result } = renderHook(
            () =>
                useOnboardingDetailsQuery({
                    onboardingId: 'ob_1',
                    refetchInterval,
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(refetchInterval).toHaveBeenCalled()
    })

    it('does not fetch when disabled', async () => {
        const { result } = renderHook(
            () =>
                useOnboardingDetailsQuery({
                    onboardingId: 'ob_1',
                    enabled: false,
                }),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(fetchOnboardingDetails).not.toHaveBeenCalled()
    })
})
