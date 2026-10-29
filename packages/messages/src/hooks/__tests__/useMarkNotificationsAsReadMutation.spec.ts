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
import { act, renderHook, waitFor } from '@testing-library/react'
import { createWrapper } from '@perawallet/wallet-extension-platform/test-utils'
import { useMarkNotificationsAsReadMutation } from '../useMarkNotificationsAsReadMutation'
import { updateLastSeenNotification } from '../../api/notifications'
import { useAnyEnabledChainHasCapability } from '@perawallet/wallet-core-chain-shared'
import type { WalletMode } from '@perawallet/wallet-core-chain-contract'
import { useDeploymentDeviceID } from '@perawallet/wallet-core-device'

const modeState = vi.hoisted(() => ({ current: 'live' as WalletMode }))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useAnyEnabledChainHasCapability: vi.fn(() => true),
    useWalletDeployment: () => modeState.current,
}))

vi.mock('../../api/notifications', () => ({
    updateLastSeenNotification: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-device', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-device')>()
    return {
        ...actual,
        useDeploymentDeviceID: vi.fn().mockReturnValue('test-device-id'),
    }
})

describe('useMarkNotificationsAsReadMutation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        modeState.current = 'live'
        vi.mocked(useAnyEnabledChainHasCapability).mockReturnValue(true)
        vi.mocked(useDeploymentDeviceID).mockReturnValue('test-device-id')
    })

    it('calls updateLastSeenNotification with correct parameters', async () => {
        vi.mocked(updateLastSeenNotification).mockResolvedValue(undefined)

        const { result } = renderHook(
            () => useMarkNotificationsAsReadMutation(),
            {
                wrapper: createWrapper(),
            },
        )

        result.current.markAsRead(12345)

        await waitFor(() => {
            expect(updateLastSeenNotification).toHaveBeenCalledWith(
                'live',
                'test-device-id',
                12345,
            )
        })
    })

    it('handles mutation error', async () => {
        const mockError = new Error('Network error')
        vi.mocked(updateLastSeenNotification).mockRejectedValue(mockError)

        const { result } = renderHook(
            () => useMarkNotificationsAsReadMutation(),
            {
                wrapper: createWrapper(),
            },
        )

        result.current.markAsRead(12345)

        await waitFor(() => {
            expect(updateLastSeenNotification).toHaveBeenCalledWith(
                'live',
                'test-device-id',
                12345,
            )
        })
    })

    it('falls back to empty string when deviceID is null', async () => {
        vi.mocked(useDeploymentDeviceID).mockReturnValueOnce(null)
        vi.mocked(updateLastSeenNotification).mockResolvedValue(undefined)

        const { result } = renderHook(
            () => useMarkNotificationsAsReadMutation(),
            { wrapper: createWrapper() },
        )

        result.current.markAsRead(1)

        await waitFor(() => {
            expect(updateLastSeenNotification).toHaveBeenCalledWith(
                'live',
                '',
                1,
            )
        })
    })

    it('marks notifications read against the developer deployment', async () => {
        modeState.current = 'developer'
        vi.mocked(updateLastSeenNotification).mockResolvedValue(undefined)

        const { result } = renderHook(
            () => useMarkNotificationsAsReadMutation(),
            { wrapper: createWrapper() },
        )

        result.current.markAsRead(12345)

        await waitFor(() => {
            expect(updateLastSeenNotification).toHaveBeenCalledWith(
                'developer',
                'test-device-id',
                12345,
            )
        })
        expect(useDeploymentDeviceID).toHaveBeenCalledWith('developer')
    })

    it('no-ops markAsRead and flags isUnavailableOnNetwork when no enabled chain has notifications', async () => {
        vi.mocked(useAnyEnabledChainHasCapability).mockReturnValue(false)

        const { result } = renderHook(
            () => useMarkNotificationsAsReadMutation(),
            { wrapper: createWrapper() },
        )

        expect(result.current.isUnavailableOnNetwork).toBe(true)
        expect(useAnyEnabledChainHasCapability).toHaveBeenCalledWith(
            'notifications',
        )

        result.current.markAsRead(12345)

        await new Promise(resolve => setTimeout(resolve, 0))

        expect(updateLastSeenNotification).not.toHaveBeenCalled()
    })

    // NotificationsScreen lists markAsRead as an effect dependency and marks
    // read from that effect's cleanup, so an unstable identity would mark the
    // list read on every render instead of on unmount.
    it('keeps a stable markAsRead identity across re-renders', () => {
        const { result, rerender } = renderHook(
            () => useMarkNotificationsAsReadMutation(),
            { wrapper: createWrapper() },
        )

        const first = result.current.markAsRead
        rerender()

        modeState.current = 'developer'
        vi.mocked(useDeploymentDeviceID).mockReturnValue('dev-2')
        rerender()

        expect(result.current.markAsRead).toBe(first)
    })

    it('posts on the deployment and device it was called with when they change mid-request', async () => {
        vi.mocked(updateLastSeenNotification).mockResolvedValue(undefined)
        const { result, rerender } = renderHook(
            () => useMarkNotificationsAsReadMutation(),
            { wrapper: createWrapper() },
        )

        act(() => {
            result.current.markAsRead(12345)
        })
        modeState.current = 'developer'
        vi.mocked(useDeploymentDeviceID).mockReturnValue('dev-2')
        rerender()

        await waitFor(() => {
            expect(updateLastSeenNotification).toHaveBeenCalledWith(
                'live',
                'test-device-id',
                12345,
            )
        })
    })
})
