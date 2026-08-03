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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import {
    onlineManager,
    QueryClient,
    QueryClientProvider,
} from '@tanstack/react-query'
import { createWrapper } from '@perawallet/wallet-extension-platform'
import {
    mutationDefaults,
    NoConnectionError,
} from '@perawallet/wallet-core-shared'
import React from 'react'
import { useAccountNotificationEnabledMutation } from '../useAccountNotificationEnabledMutation'
import { updateNotificationEnabled } from '../../api/notifications'

vi.mock('../../api/notifications', () => ({
    updateNotificationEnabled: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-device', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-device')>()
    return {
        ...actual,
        useDeviceID: vi.fn().mockReturnValue('test-device-id'),
    }
})

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: vi.fn().mockReturnValue({ network: 'mainnet' }),
}))

describe('useAccountNotificationEnabledMutation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('calls updateNotificationEnabled with correct parameters when enabling', async () => {
        vi.mocked(updateNotificationEnabled).mockResolvedValue({
            has_new_notification: false,
        })

        const { result } = renderHook(
            () => useAccountNotificationEnabledMutation(),
            {
                wrapper: createWrapper(),
            },
        )

        result.current.mutate({ accountID: 'test-account', status: true })

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        expect(updateNotificationEnabled).toHaveBeenCalledWith(
            'mainnet',
            'test-device-id',
            'test-account',
            true,
        )
    })

    it('calls updateNotificationEnabled with correct parameters when disabling', async () => {
        vi.mocked(updateNotificationEnabled).mockResolvedValue({
            has_new_notification: false,
        })

        const { result } = renderHook(
            () => useAccountNotificationEnabledMutation(),
            {
                wrapper: createWrapper(),
            },
        )

        result.current.mutate({ accountID: 'test-account', status: false })

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        expect(updateNotificationEnabled).toHaveBeenCalledWith(
            'mainnet',
            'test-device-id',
            'test-account',
            false,
        )
    })

    it('handles mutation error', async () => {
        const mockError = new Error('Network error')
        vi.mocked(updateNotificationEnabled).mockRejectedValue(mockError)

        const { result } = renderHook(
            () => useAccountNotificationEnabledMutation(),
            {
                wrapper: createWrapper(),
            },
        )

        result.current.mutate({ accountID: 'test-account', status: true })

        await waitFor(() => {
            expect(result.current.isError).toBe(true)
        })

        expect(result.current.error).toBe(mockError)
    })

    // PERA-XXXX: the toggle runs under networkMode 'always', so offline the
    // mutationFn still runs. Without an explicit connectivity guard it relies
    // on the native transport rejecting the request, which is prompt on iOS
    // but not on Android (airplane mode) — leaving the optimistic-rollback in
    // the toggle handler to never run and the persisted store to diverge from
    // the backend. assertOnline() makes the failure fast and identical on both
    // platforms, mirroring the money-flow mutations.
    describe('offline', () => {
        afterEach(() => onlineManager.setOnline(true))

        it('rejects with NoConnectionError before calling the API when offline', async () => {
            // Mirrors the app's root QueryClient policy: mutationDefaults
            // (networkMode: 'always') makes the mutationFn run — and reject
            // via assertOnline — offline instead of pausing. The shared
            // createWrapper uses the default 'online' mode, which would pause
            // the mutation and never invoke the guard.
            const queryClient = new QueryClient({
                defaultOptions: {
                    queries: { retry: false },
                    mutations: { ...mutationDefaults, retry: false },
                },
            })
            const wrapper = ({ children }: { children: React.ReactNode }) =>
                React.createElement(
                    QueryClientProvider,
                    { client: queryClient },
                    children,
                )

            onlineManager.setOnline(false)

            const { result } = renderHook(
                () => useAccountNotificationEnabledMutation(),
                { wrapper },
            )

            await act(async () => {
                await expect(
                    result.current.mutateAsync({
                        accountID: 'test-account',
                        status: false,
                    }),
                ).rejects.toBeInstanceOf(NoConnectionError)
            })

            expect(updateNotificationEnabled).not.toHaveBeenCalled()
        })
    })
})
