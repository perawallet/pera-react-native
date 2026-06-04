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

const { fetchRegistrationSettings } = vi.hoisted(() => ({
    fetchRegistrationSettings: vi.fn(),
}))
vi.mock('../../api/onboarding', () => ({ fetchRegistrationSettings }))

import { useRegistrationSettingsQuery } from '../useRegistrationSettingsQuery'

describe('useRegistrationSettingsQuery', () => {
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

    it('exposes the fetched registration settings', async () => {
        fetchRegistrationSettings.mockResolvedValue({
            countries: [
                {
                    id: 'c1',
                    iso3166alpha2: 'GB',
                    name: 'United Kingdom',
                    callingCode: '44',
                    canSignUp: true,
                },
            ],
            usStates: [],
        })

        const { result } = renderHook(() => useRegistrationSettingsQuery(), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.data?.countries[0].iso3166alpha2).toBe('GB')
    })
})
