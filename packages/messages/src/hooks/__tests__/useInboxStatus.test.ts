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

import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createWrapper } from '@perawallet/wallet-extension-platform'
import { useInboxStatus } from '../useInboxStatus'
import { fetchMessageStatus } from '../../api/notifications'
import { useDeviceID } from '@perawallet/wallet-core-device'

vi.mock('../../api/notifications', () => ({
    fetchMessageStatus: vi.fn(),
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
    useNetwork: vi.fn().mockReturnValue({ network: 'test-network' }),
}))

describe('useInboxStatus', () => {
    it('returns status from the unified message-status endpoint', async () => {
        vi.mocked(fetchMessageStatus).mockResolvedValue({
            hasUnreadItems: true,
            hasUnreadNotifications: false,
            hasUnreadInboxItems: true,
        })

        const { result } = renderHook(() => useInboxStatus(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.hasUnreadItems).toBe(true)
        })

        expect(fetchMessageStatus).toHaveBeenCalledWith(
            'test-network',
            'test-device-id',
        )
        expect(result.current.hasUnreadItems).toBe(true)
        expect(result.current.hasUnreadInboxItems).toBe(true)
        expect(result.current.hasUnreadNotifications).toBe(false)
    })

    it('returns all false when there are no unread items', async () => {
        vi.mocked(fetchMessageStatus).mockResolvedValue({
            hasUnreadItems: false,
            hasUnreadNotifications: false,
            hasUnreadInboxItems: false,
        })

        const { result } = renderHook(() => useInboxStatus(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(fetchMessageStatus).toHaveBeenCalled()
        })

        expect(result.current.hasUnreadItems).toBe(false)
        expect(result.current.hasUnreadInboxItems).toBe(false)
        expect(result.current.hasUnreadNotifications).toBe(false)
    })

    it('skips the fetch and returns defaults when deviceID is missing', async () => {
        vi.mocked(useDeviceID).mockReturnValueOnce(null)
        vi.mocked(fetchMessageStatus).mockClear()

        const { result } = renderHook(() => useInboxStatus(), {
            wrapper: createWrapper(),
        })

        expect(fetchMessageStatus).not.toHaveBeenCalled()
        expect(result.current.hasUnreadItems).toBe(false)
        expect(result.current.hasUnreadNotifications).toBe(false)
        expect(result.current.hasUnreadInboxItems).toBe(false)
    })
})