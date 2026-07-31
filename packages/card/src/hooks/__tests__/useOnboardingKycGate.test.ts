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
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const mockUseNetwork = vi.hoisted(() => vi.fn())
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: mockUseNetwork,
}))

const { fetchOnboardingDetails } = vi.hoisted(() => ({
    fetchOnboardingDetails: vi.fn(),
}))
vi.mock('../../api/onboarding', async () => ({
    ...(await vi.importActual('../../api/onboarding')),
    fetchOnboardingDetails,
}))

import { useOnboardingKycGate } from '../useOnboardingKycGate'

let queryClient: QueryClient
const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

const ONBOARDING_ID = 'ob_1'
const record = (verificationState: string) => ({
    verificationState,
    firstName: null,
    lastName: null,
    dateOfBirth: null,
    countryOfNationality: null,
})

const renderGate = () =>
    renderHook(() => useOnboardingKycGate({ onboardingId: ONBOARDING_ID }), {
        wrapper,
    })

describe('useOnboardingKycGate', () => {
    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        vi.clearAllMocks()
        mockUseNetwork.mockReturnValue({ network: 'testnet' })
    })

    it.each([
        ['PENDING', false],
        ['VERIFIED', false],
        ['UNVERIFIED', true],
        ['REJECTED', true],
    ])('a %s record blocks the step: %s', async (state, expected) => {
        fetchOnboardingDetails.mockResolvedValue(record(state))
        const { result } = renderGate()

        await waitFor(() => expect(result.current.isKycRequired).toBe(expected))
    })

    it('does not block while the record is unfetched', () => {
        fetchOnboardingDetails.mockReturnValue(new Promise(() => {}))
        const { result } = renderGate()

        // The submit-time refusal is the backstop; blocking here would show
        // the verify prompt to everyone on a slow fetch.
        expect(result.current.isKycRequired).toBe(false)
    })

    it('does not block when the record fetch fails', async () => {
        fetchOnboardingDetails.mockRejectedValue(new Error('boom'))
        const { result } = renderGate()

        await waitFor(() => expect(fetchOnboardingDetails).toHaveBeenCalled())
        expect(result.current.isKycRequired).toBe(false)
    })

    // The reported bug: Baanx reports PENDING from the moment a Veriff session
    // is created, so an abandoned check reads as submitted. Once the server has
    // refused, PENDING must stop reopening the step or the user loops.
    it('keeps blocking after a refusal even though PENDING normally proceeds', async () => {
        fetchOnboardingDetails.mockResolvedValue(record('PENDING'))
        const { result } = renderGate()
        await waitFor(() => expect(result.current.isKycRequired).toBe(false))

        act(() => {
            result.current.markServerRefused()
        })

        expect(result.current.isKycRequired).toBe(true)
    })

    it('ignores a cached VERIFIED that predates the refusal', async () => {
        fetchOnboardingDetails.mockResolvedValue(record('VERIFIED'))
        const { result } = renderGate()
        await waitFor(() => expect(result.current.isKycRequired).toBe(false))

        act(() => {
            result.current.markServerRefused()
        })

        // The cached record is exactly the optimistic state the refusal
        // contradicted, so it must not clear the gate on its own.
        expect(result.current.isKycRequired).toBe(true)
    })

    it('reopens the step once a newer fetch reports VERIFIED', async () => {
        fetchOnboardingDetails.mockResolvedValue(record('PENDING'))
        const { result } = renderGate()
        await waitFor(() => expect(result.current.isKycRequired).toBe(false))

        act(() => {
            result.current.markServerRefused()
        })
        expect(result.current.isKycRequired).toBe(true)

        // KYC actually completes; the refusing mutation invalidates this query
        // in production, so simulate the resulting refetch.
        fetchOnboardingDetails.mockResolvedValue(record('VERIFIED'))
        await act(async () => {
            await queryClient.invalidateQueries()
        })

        await waitFor(() => expect(result.current.isKycRequired).toBe(false))
    })
})
