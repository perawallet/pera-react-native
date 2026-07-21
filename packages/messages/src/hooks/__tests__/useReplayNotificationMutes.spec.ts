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

import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { notificationsStoreMock, deviceStoreMock, updateNotificationEnabled } =
    vi.hoisted(() => ({
        notificationsStoreMock: {
            notificationDisabledAccounts: [] as string[],
        },
        deviceStoreMock: { deviceIDs: new Map<string, string>() },
        updateNotificationEnabled: vi.fn(),
    }))

vi.mock('../../api/notifications', () => ({
    updateNotificationEnabled,
}))

vi.mock('../../store', () => ({
    useNotificationsStore: { getState: () => notificationsStoreMock },
}))

vi.mock('@perawallet/wallet-core-device', () => ({
    useDeviceStore: { getState: () => deviceStoreMock },
}))

vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return {
        ...original,
        logger: { warn: vi.fn() },
    }
})

import { useReplayNotificationMutes } from '../useReplayNotificationMutes'

describe('useReplayNotificationMutes', () => {
    let queryClient: QueryClient
    let wrapper: ({
        children,
    }: {
        children: ReactNode
    }) => ReturnType<typeof createElement>

    beforeEach(() => {
        vi.clearAllMocks()
        notificationsStoreMock.notificationDisabledAccounts = []
        deviceStoreMock.deviceIDs = new Map()
        updateNotificationEnabled.mockResolvedValue({})
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
        wrapper = ({ children }) =>
            createElement(
                QueryClientProvider,
                { client: queryClient },
                children,
            )
    })

    it('PATCHes receive_notifications=false for every locally muted account', async () => {
        notificationsStoreMock.notificationDisabledAccounts = [
            'MUTED1',
            'MUTED2',
        ]
        deviceStoreMock.deviceIDs = new Map([['mainnet', 'DEV-2']])
        const { result } = renderHook(() => useReplayNotificationMutes(), {
            wrapper,
        })

        act(() => result.current('mainnet'))

        await waitFor(() => {
            expect(updateNotificationEnabled).toHaveBeenCalledWith(
                'mainnet',
                'DEV-2',
                'MUTED1',
                false,
            )
            expect(updateNotificationEnabled).toHaveBeenCalledWith(
                'mainnet',
                'DEV-2',
                'MUTED2',
                false,
            )
        })
    })

    it('resets the badge and list caches once after a successful replay', async () => {
        notificationsStoreMock.notificationDisabledAccounts = ['MUTED1']
        deviceStoreMock.deviceIDs = new Map([['mainnet', 'DEV-2']])
        const resetSpy = vi.spyOn(queryClient, 'resetQueries')
        const { result } = renderHook(() => useReplayNotificationMutes(), {
            wrapper,
        })

        act(() => result.current('mainnet'))

        await waitFor(() => {
            expect(resetSpy).toHaveBeenCalledWith({
                queryKey: [
                    'notifications',
                    'message-status',
                    { deviceID: 'DEV-2', network: 'mainnet' },
                ],
            })
            expect(resetSpy).toHaveBeenCalledWith({
                queryKey: [
                    'notifications',
                    'notification-status',
                    { deviceID: 'DEV-2', network: 'mainnet' },
                ],
            })
            expect(resetSpy).toHaveBeenCalledWith({
                queryKey: [
                    'notifications',
                    'listv2',
                    { deviceID: 'DEV-2', network: 'mainnet' },
                ],
            })
        })
    })

    it('does not reset any caches when every replay call fails', async () => {
        updateNotificationEnabled.mockRejectedValue(new Error('boom'))
        notificationsStoreMock.notificationDisabledAccounts = ['MUTED1']
        deviceStoreMock.deviceIDs = new Map([['mainnet', 'DEV-2']])
        const resetSpy = vi.spyOn(queryClient, 'resetQueries')
        const { result } = renderHook(() => useReplayNotificationMutes(), {
            wrapper,
        })

        act(() => result.current('mainnet'))

        await waitFor(() =>
            expect(updateNotificationEnabled).toHaveBeenCalled(),
        )
        expect(resetSpy).not.toHaveBeenCalled()
    })

    it('does nothing when nothing is muted', () => {
        notificationsStoreMock.notificationDisabledAccounts = []
        const { result } = renderHook(() => useReplayNotificationMutes(), {
            wrapper,
        })

        act(() => result.current('mainnet'))

        expect(updateNotificationEnabled).not.toHaveBeenCalled()
    })

    it('does nothing when there is no device id for the network', () => {
        notificationsStoreMock.notificationDisabledAccounts = ['MUTED1']
        deviceStoreMock.deviceIDs = new Map()
        const { result } = renderHook(() => useReplayNotificationMutes(), {
            wrapper,
        })

        act(() => result.current('mainnet'))

        expect(updateNotificationEnabled).not.toHaveBeenCalled()
    })

    it('logs a warning and does not throw when the PATCH fails', async () => {
        const { logger } = await import('@perawallet/wallet-core-shared')
        updateNotificationEnabled.mockRejectedValueOnce(new Error('boom'))
        notificationsStoreMock.notificationDisabledAccounts = ['MUTED1']
        deviceStoreMock.deviceIDs = new Map([['mainnet', 'DEV-2']])
        const { result } = renderHook(() => useReplayNotificationMutes(), {
            wrapper,
        })

        act(() => result.current('mainnet'))

        await waitFor(() => {
            expect(logger.warn).toHaveBeenCalledWith(
                'Notification mute replay failed',
                expect.objectContaining({
                    source: 'useReplayNotificationMutes',
                    address: 'MUTED1',
                }),
            )
        })
    })
})
