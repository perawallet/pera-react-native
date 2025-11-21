import { useV1DevicesNotificationsListInfinite, v1DevicesNotificationsListQueryKey, type NotificationV2SerializerResponse } from "../../api/index"
import { useDeviceID } from "../../services/device"
import { useCallback, useMemo } from "react"

export const useNotificationsListQueryKeys = () => {
    const deviceID = useDeviceID()
    return deviceID ? [
        v1DevicesNotificationsListQueryKey({ device_id: deviceID })
    ] : []
}

export const useNotificationsList = () => {
    const deviceID = useDeviceID()

    const { data, isPending, fetchNextPage, isFetchingNextPage, hasNextPage } =
        useV1DevicesNotificationsListInfinite(
            {
                device_id: deviceID!,
            },
            {
                query: {
                    enabled: !!deviceID,
                },
            },
        )

    const loadMoreItems = useCallback(async () => {
        if (hasNextPage) {
            await fetchNextPage({})
        }
    }, [hasNextPage, fetchNextPage])

    return useMemo<{
        data: NotificationV2SerializerResponse[],
        isPending: boolean,
        fetchNextPage: () => void,
        isFetchingNextPage: boolean,
        loadMoreItems: () => void
    }>(() => ({
        data: data?.pages.flatMap(p => p.results) ?? [],
        isPending,
        fetchNextPage,
        isFetchingNextPage,
        loadMoreItems
    }), [data, isPending, fetchNextPage, isFetchingNextPage, loadMoreItems])
}