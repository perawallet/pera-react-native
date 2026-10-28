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
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

const { startRegisterVerification, fetchVerificationSession, hasCardSession } =
    vi.hoisted(() => ({
        startRegisterVerification: vi.fn(),
        fetchVerificationSession: vi.fn(),
        hasCardSession: vi.fn(),
    }))
vi.mock('../../api/onboarding', () => ({ startRegisterVerification }))
vi.mock('../../api/user', () => ({ fetchVerificationSession }))
vi.mock('../../session', () => ({ hasCardSession }))

import {
    type ChainScope,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import { useStartVerificationMutation } from '../useStartVerificationMutation'

const SCOPES: ChainScope[] = [
    { chainId: LEGACY_CHAIN_ID, networkId: 'mainnet' } as const,
    { chainId: 'ethereum', networkId: 'sepolia' },
]

describe.each(SCOPES)('useStartVerificationMutation ($chainId)', SCOPE => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: { retry: false },
                mutations: { retry: false },
            },
        })
        vi.clearAllMocks()
        hasCardSession.mockReturnValue(false)
    })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    it('starts pre-auth KYC with the onboarding id and returns the session url', async () => {
        startRegisterVerification.mockResolvedValue({
            sessionUrl: 'https://kyc.example/session',
        })

        const { result } = renderHook(
            () => useStartVerificationMutation(SCOPE),
            {
                wrapper,
            },
        )
        result.current.mutate({ onboardingId: 'ob_1' })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(startRegisterVerification).toHaveBeenCalledWith({
            onboardingId: 'ob_1',
            scope: SCOPE,
        })
        expect(result.current.data?.sessionUrl).toBe(
            'https://kyc.example/session',
        )
    })

    it('starts KYC through the authenticated endpoint when a session already exists', async () => {
        hasCardSession.mockReturnValue(true)
        fetchVerificationSession.mockResolvedValue({
            sessionUrl: 'https://kyc.example/session',
        })

        const { result } = renderHook(
            () => useStartVerificationMutation(SCOPE),
            { wrapper },
        )
        result.current.mutate({ onboardingId: null })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(fetchVerificationSession).toHaveBeenCalledWith({ scope: SCOPE })
        expect(startRegisterVerification).not.toHaveBeenCalled()
    })

    it('fails without an onboarding id when there is no session', async () => {
        const { result } = renderHook(
            () => useStartVerificationMutation(SCOPE),
            { wrapper },
        )
        result.current.mutate({ onboardingId: null })

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(startRegisterVerification).not.toHaveBeenCalled()
    })
})
