import { renderHook } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import {
    useNotificationsList,
    useNotificationsListQueryKeys,
} from '../useNotificationsList'

// Mock dependencies
const mockUseV1DevicesNotificationsListInfinite = vi.hoisted(() => vi.fn())
vi.mock('../../../api/index', () => ({
    useV1DevicesNotificationsListInfinite: mockUseV1DevicesNotificationsListInfinite,
    v1DevicesNotificationsListQueryKey: vi.fn(() => ['notificationsList']),
}))

const mockUseDeviceID = vi.hoisted(() => vi.fn())
vi.mock('../../../services/device', () => ({
    useDeviceID: mockUseDeviceID,
}))

describe('useNotificationsList', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseDeviceID.mockReturnValue('device-123')
    })

    describe('useNotificationsListQueryKeys', () => {
        it('returns query keys when device ID is present', () => {
            const { result } = renderHook(() => useNotificationsListQueryKeys())
            expect(result.current).toEqual([['notificationsList']])
        })

        it('returns empty array when device ID is missing', () => {
            mockUseDeviceID.mockReturnValue(null)
            const { result } = renderHook(() => useNotificationsListQueryKeys())
            expect(result.current).toEqual([])
        })
    })

    describe('useNotificationsList hook', () => {
        it('fetches and flattens notifications', () => {
            mockUseV1DevicesNotificationsListInfinite.mockReturnValue({
                data: {
                    pages: [
                        { results: [{ id: 1 }, { id: 2 }] },
                        { results: [{ id: 3 }] },
                    ],
                },
                isPending: false,
                fetchNextPage: vi.fn(),
                isFetchingNextPage: false,
                hasNextPage: true,
            })

            const { result } = renderHook(() => useNotificationsList())

            expect(result.current.data).toHaveLength(3)
            expect(result.current.data[0].id).toBe(1)
            expect(result.current.data[2].id).toBe(3)
        })

        it('handles loading state', () => {
            mockUseV1DevicesNotificationsListInfinite.mockReturnValue({
                data: undefined,
                isPending: true,
                fetchNextPage: vi.fn(),
                isFetchingNextPage: false,
                hasNextPage: false,
            })

            const { result } = renderHook(() => useNotificationsList())

            expect(result.current.isPending).toBe(true)
            expect(result.current.data).toEqual([])
        })

        it('loadMoreItems calls fetchNextPage if hasNextPage is true', async () => {
            const fetchNextPage = vi.fn()
            mockUseV1DevicesNotificationsListInfinite.mockReturnValue({
                data: { pages: [] },
                isPending: false,
                fetchNextPage,
                isFetchingNextPage: false,
                hasNextPage: true,
            })

            const { result } = renderHook(() => useNotificationsList())

            await result.current.loadMoreItems()

            expect(fetchNextPage).toHaveBeenCalled()
        })

        it('loadMoreItems does not call fetchNextPage if hasNextPage is false', async () => {
            const fetchNextPage = vi.fn()
            mockUseV1DevicesNotificationsListInfinite.mockReturnValue({
                data: { pages: [] },
                isPending: false,
                fetchNextPage,
                isFetchingNextPage: false,
                hasNextPage: false,
            })

            const { result } = renderHook(() => useNotificationsList())

            await result.current.loadMoreItems()

            expect(fetchNextPage).not.toHaveBeenCalled()
        })
    })
})
