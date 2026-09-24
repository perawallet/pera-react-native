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

const walletProvisioning = vi.hoisted(() => ({
    checkWalletAvailability: vi.fn(),
    getCardStatusBySuffix: vi.fn(),
}))
vi.mock('@perawallet/wallet-extension-provider', () => ({
    getProvider: () => ({ walletProvisioning }),
}))

import { useWalletProvisioningAvailabilityQuery } from '../useWalletProvisioningAvailabilityQuery'
import { useWalletProvisioningStatusQuery } from '../useWalletProvisioningStatusQuery'

describe('wallet provisioning queries', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        vi.clearAllMocks()
        walletProvisioning.checkWalletAvailability.mockResolvedValue(true)
        walletProvisioning.getCardStatusBySuffix.mockResolvedValue('active')
    })

    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )

    it('reports availability from the platform service', async () => {
        const { result } = renderHook(
            () => useWalletProvisioningAvailabilityQuery(),
            { wrapper },
        )

        await waitFor(() => expect(result.current.data).toBe(true))
    })

    it('does not probe availability when disabled', async () => {
        renderHook(
            () => useWalletProvisioningAvailabilityQuery({ enabled: false }),
            { wrapper },
        )

        await waitFor(() =>
            expect(
                walletProvisioning.checkWalletAvailability,
            ).not.toHaveBeenCalled(),
        )
    })

    it('reports the in-wallet card status for the pan suffix', async () => {
        const { result } = renderHook(
            () => useWalletProvisioningStatusQuery('2234'),
            { wrapper },
        )

        await waitFor(() => expect(result.current.data).toBe('active'))
        expect(walletProvisioning.getCardStatusBySuffix).toHaveBeenCalledWith(
            '2234',
        )
    })

    it('does not probe the status without a pan suffix', async () => {
        renderHook(() => useWalletProvisioningStatusQuery(null), { wrapper })

        await waitFor(() =>
            expect(
                walletProvisioning.getCardStatusBySuffix,
            ).not.toHaveBeenCalled(),
        )
    })
})
