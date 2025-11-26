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

import { renderHook } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import {
    useNotificationStatus,
    useNotificationStatusQueryKeys,
} from '../useNotificationStatus'

// Mock dependencies
const mockUseV1DevicesNotificationStatusList = vi.hoisted(() => vi.fn())
vi.mock('../../../api/index', () => ({
    useV1DevicesNotificationStatusList: mockUseV1DevicesNotificationStatusList,
    v1DevicesNotificationStatusListQueryKey: vi.fn(() => [
        'notificationStatus',
    ]),
}))

const mockUseDeviceID = vi.hoisted(() => vi.fn())
vi.mock('../../../services/device', () => ({
    useDeviceID: mockUseDeviceID,
}))

describe('useNotificationStatus', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseDeviceID.mockReturnValue('device-123')
    })

    describe('useNotificationStatusQueryKeys', () => {
        it('returns query keys when device ID is present', () => {
            const { result } = renderHook(() =>
                useNotificationStatusQueryKeys(),
            )
            expect(result.current).toEqual([['notificationStatus']])
        })

        it('returns empty array when device ID is missing', () => {
            mockUseDeviceID.mockReturnValue(null)
            const { result } = renderHook(() =>
                useNotificationStatusQueryKeys(),
            )
            expect(result.current).toEqual([])
        })
    })

    describe('useNotificationStatus hook', () => {
        it('returns hasNotifications true when API returns true', () => {
            mockUseV1DevicesNotificationStatusList.mockReturnValue({
                data: { has_new_notification: true },
            })

            const { result } = renderHook(() => useNotificationStatus())

            expect(result.current.hasNotifications).toBe(true)
        })

        it('returns hasNotifications false when API returns false', () => {
            mockUseV1DevicesNotificationStatusList.mockReturnValue({
                data: { has_new_notification: false },
            })

            const { result } = renderHook(() => useNotificationStatus())

            expect(result.current.hasNotifications).toBe(false)
        })

        it('returns hasNotifications false when data is undefined', () => {
            mockUseV1DevicesNotificationStatusList.mockReturnValue({
                data: undefined,
            })

            const { result } = renderHook(() => useNotificationStatus())

            expect(result.current.hasNotifications).toBe(false)
        })

        it('disables query when device ID is missing', () => {
            mockUseDeviceID.mockReturnValue(null)
            renderHook(() => useNotificationStatus())

            expect(mockUseV1DevicesNotificationStatusList).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    query: expect.objectContaining({
                        enabled: false,
                    }),
                }),
            )
        })
    })
})
