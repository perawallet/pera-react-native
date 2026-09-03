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
import { createWrapper } from '@perawallet/wallet-extension-platform'
import { useNetwork } from '@perawallet/wallet-core-blockchain'
import { Networks } from '@perawallet/wallet-core-config'
import { useMarkNotificationsAsReadMutation } from '../useMarkNotificationsAsReadMutation'
import { updateLastSeenNotification } from '../../api/notifications'
import { useDeviceID } from '@perawallet/wallet-core-device'

vi.mock('../../api/notifications', () => ({
    updateLastSeenNotification: vi.fn(),
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

describe('useMarkNotificationsAsReadMutation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useNetwork).mockReturnValue({
            network: 'mainnet',
        } as ReturnType<typeof useNetwork>)
        vi.mocked(useDeviceID).mockReturnValue('test-device-id')
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
                'mainnet',
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
                'mainnet',
                'test-device-id',
                12345,
            )
        })
    })

    it('falls back to empty string when deviceID is null', async () => {
        vi.mocked(useDeviceID).mockReturnValueOnce(null)
        vi.mocked(updateLastSeenNotification).mockResolvedValue(undefined)

        const { result } = renderHook(
            () => useMarkNotificationsAsReadMutation(),
            { wrapper: createWrapper() },
        )

        result.current.markAsRead(1)

        await waitFor(() => {
            expect(updateLastSeenNotification).toHaveBeenCalledWith(
                'mainnet',
                '',
                1,
            )
        })
    })

    describe('non-Pera-backed networks', () => {
        it.each([Networks.betanet, Networks.custom])(
            'no-ops markAsRead and flags isUnavailableOnNetwork on %s',
            async network => {
                vi.mocked(useNetwork).mockReturnValue({
                    network,
                } as ReturnType<typeof useNetwork>)

                const { result } = renderHook(
                    () => useMarkNotificationsAsReadMutation(),
                    { wrapper: createWrapper() },
                )

                expect(result.current.isUnavailableOnNetwork).toBe(true)

                result.current.markAsRead(12345)

                await new Promise(resolve => setTimeout(resolve, 0))

                expect(updateLastSeenNotification).not.toHaveBeenCalled()
            },
        )
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

        expect(result.current.markAsRead).toBe(first)
    })
})
