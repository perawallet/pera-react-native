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
import { renderHook, waitFor } from '@testing-library/react'
import { config } from '@perawallet/wallet-core-config'
import { createWrapper } from '@perawallet/wallet-extension-platform/test-utils'
import { useInboxStatus } from '../useInboxStatus'
import {
    fetchMessageStatus,
    fetchNotificationStatus,
} from '../../api/notifications'
import { useInboxQuery } from '../useInboxQuery'
import type { WalletMode } from '@perawallet/wallet-core-chain-contract'
import { useAnyEnabledChainHasCapability } from '@perawallet/wallet-core-chain-shared'
import { useDeploymentDeviceID } from '@perawallet/wallet-core-device'

const ALGORAND_MAINNET = { chainId: 'algorand', networkId: 'mainnet' } as const
const ETHEREUM = { chainId: 'ethereum', networkId: 'sepolia' } as const

const modeState = vi.hoisted(() => ({ current: 'live' as WalletMode }))

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    useAnyEnabledChainHasCapability: vi.fn(() => true),
    useNetworkStore: vi.fn(
        (selector: (state: { mode: WalletMode }) => unknown) =>
            selector({ mode: modeState.current }),
    ),
}))

vi.mock('../../api/notifications', () => ({
    fetchMessageStatus: vi.fn(),
    fetchNotificationStatus: vi.fn(),
}))

vi.mock('../useInboxQuery', () => ({
    useInboxQuery: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-device', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-device')>()
    return {
        ...actual,
        useDeploymentDeviceID: vi.fn().mockReturnValue('test-device-id'),
    }
})

const mockInbox = (items: number) =>
    vi.mocked(useInboxQuery).mockReturnValue({
        data: Array.from({ length: items }, () => ({})),
    } as unknown as ReturnType<typeof useInboxQuery>)

describe('useInboxStatus', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockInbox(0)
        modeState.current = 'live'
        vi.mocked(useAnyEnabledChainHasCapability).mockReturnValue(true)
    })

    it('surfaces the unread flags and inbox count from message-status', async () => {
        vi.mocked(fetchMessageStatus).mockResolvedValue({
            hasUnreadItems: true,
            hasUnreadNotifications: true,
            hasUnreadInboxItems: true,
            unreadInboxCount: 3,
        })

        const { result } = renderHook(() => useInboxStatus(ALGORAND_MAINNET), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.unreadInboxCount).toBe(3)
        })

        expect(fetchMessageStatus).toHaveBeenCalledWith(
            'live',
            'test-device-id',
        )
        expect(result.current.hasUnreadItems).toBe(true)
        expect(result.current.hasUnreadNotifications).toBe(true)
        expect(result.current.hasUnreadInboxItems).toBe(true)
        // Happy path must not touch the legacy fallback endpoint.
        expect(fetchNotificationStatus).not.toHaveBeenCalled()
    })

    it('reads message status from the deployment and the fallback inbox from the scope', async () => {
        modeState.current = 'developer'
        vi.mocked(fetchMessageStatus).mockResolvedValue({
            hasUnreadItems: true,
            hasUnreadNotifications: false,
            hasUnreadInboxItems: true,
            unreadInboxCount: 1,
        })

        const { result } = renderHook(() => useInboxStatus(ETHEREUM), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.unreadInboxCount).toBe(1)
        })
        expect(useDeploymentDeviceID).toHaveBeenCalledWith('developer')
        expect(fetchMessageStatus).toHaveBeenCalledWith(
            'developer',
            'test-device-id',
        )
        expect(useInboxQuery).toHaveBeenCalledWith(ETHEREUM)
    })

    it('falls back to the legacy v1 source when message-status fails', async () => {
        vi.mocked(fetchMessageStatus).mockRejectedValue(
            new Error('v3 unavailable'),
        )
        vi.mocked(fetchNotificationStatus).mockResolvedValue({
            has_new_notification: true,
        })
        mockInbox(2)

        const { result } = renderHook(() => useInboxStatus(ALGORAND_MAINNET), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(fetchNotificationStatus).toHaveBeenCalledWith(
                'live',
                'test-device-id',
            )
        })

        await waitFor(() => {
            expect(result.current.hasUnreadNotifications).toBe(true)
        })

        expect(result.current.unreadInboxCount).toBe(2)
        expect(result.current.hasUnreadInboxItems).toBe(true)
        expect(result.current.hasUnreadItems).toBe(true)
    })

    describe('poll cadence', () => {
        beforeEach(() => {
            vi.useFakeTimers({ shouldAdvanceTime: true })
        })

        afterEach(() => {
            vi.useRealTimers()
        })

        it('polls message-status at the normal cadence while healthy', async () => {
            vi.mocked(fetchMessageStatus).mockResolvedValue({
                hasUnreadItems: false,
                hasUnreadNotifications: false,
                hasUnreadInboxItems: false,
                unreadInboxCount: 0,
            })

            renderHook(() => useInboxStatus(ALGORAND_MAINNET), {
                wrapper: createWrapper(),
            })

            await waitFor(() => {
                expect(fetchMessageStatus).toHaveBeenCalledTimes(1)
            })

            await vi.advanceTimersByTimeAsync(config.notificationRefreshTime)
            expect(fetchMessageStatus).toHaveBeenCalledTimes(2)
        })

        it('slows the v3 probe while erroring so it does not double-poll with the v1 fallback', async () => {
            vi.mocked(fetchMessageStatus).mockRejectedValue(
                new Error('v3 unavailable'),
            )
            vi.mocked(fetchNotificationStatus).mockResolvedValue({
                has_new_notification: false,
            })

            renderHook(() => useInboxStatus(ALGORAND_MAINNET), {
                wrapper: createWrapper(),
            })

            await waitFor(() => {
                expect(fetchMessageStatus).toHaveBeenCalledTimes(1)
            })

            // At the normal cadence the failing v3 endpoint must stay quiet —
            // only the v1 fallback keeps the badge fresh.
            await vi.advanceTimersByTimeAsync(config.notificationRefreshTime)
            expect(fetchMessageStatus).toHaveBeenCalledTimes(1)
            await waitFor(() => {
                expect(fetchNotificationStatus).toHaveBeenCalledTimes(2)
            })

            // The recovery probe still fires eventually (10× cadence).
            await vi.advanceTimersByTimeAsync(
                config.notificationRefreshTime * 10,
            )
            expect(fetchMessageStatus).toHaveBeenCalledTimes(2)
        })
    })

    it('returns strict false/0 defaults when deviceID is missing', () => {
        vi.mocked(useDeploymentDeviceID).mockReturnValueOnce(null)

        const { result } = renderHook(() => useInboxStatus(ALGORAND_MAINNET), {
            wrapper: createWrapper(),
        })

        expect(fetchMessageStatus).not.toHaveBeenCalled()
        expect(fetchNotificationStatus).not.toHaveBeenCalled()
        expect(result.current.hasUnreadItems).toBe(false)
        expect(result.current.hasUnreadInboxItems).toBe(false)
        expect(result.current.hasUnreadNotifications).toBe(false)
        expect(result.current.unreadInboxCount).toBe(0)
        expect(typeof result.current.hasUnreadItems).toBe('boolean')
        expect(typeof result.current.hasUnreadInboxItems).toBe('boolean')
        expect(typeof result.current.hasUnreadNotifications).toBe('boolean')
        expect(typeof result.current.unreadInboxCount).toBe('number')
    })

    it('returns zeroed-out defaults and flags isUnavailableOnNetwork without polling when no enabled chain has notifications', () => {
        vi.mocked(useAnyEnabledChainHasCapability).mockReturnValue(false)

        const { result } = renderHook(() => useInboxStatus(ALGORAND_MAINNET), {
            wrapper: createWrapper(),
        })

        expect(fetchMessageStatus).not.toHaveBeenCalled()
        expect(fetchNotificationStatus).not.toHaveBeenCalled()
        expect(result.current.hasUnreadItems).toBe(false)
        expect(result.current.hasUnreadInboxItems).toBe(false)
        expect(result.current.hasUnreadNotifications).toBe(false)
        expect(result.current.unreadInboxCount).toBe(0)
        expect(result.current.isUnavailableOnNetwork).toBe(true)
        expect(useAnyEnabledChainHasCapability).toHaveBeenCalledWith(
            'notifications',
        )
    })
})
